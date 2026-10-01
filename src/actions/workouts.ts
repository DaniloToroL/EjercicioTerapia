"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/actions/auth";
import { requireUser } from "@/lib/auth";
import { fromISODate, todayISO } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

/** Verifica que la sesión pertenece a un programa asignado al usuario. */
async function athleteSession(sessionId: string, athleteId: string) {
  return prisma.trainingSession.findFirst({
    where: { id: sessionId, microcycle: { mesocycle: { program: { athleteId, isTemplate: false } } } },
    select: { id: true },
  });
}

async function ensureWorkout(sessionId: string, athleteId: string, date: string) {
  return prisma.workoutLog.upsert({
    where: { sessionId_athleteId: { sessionId, athleteId } },
    create: { sessionId, athleteId, date: fromISODate(date) },
    update: {},
  });
}

const scale = z.number().int().min(1).max(7);
const checkinSchema = z.object({
  sessionId: z.string().min(1),
  sleepTime: scale,
  sleepQuality: scale,
  rest: scale,
  pain: scale,
  stress: scale,
  nutrition: scale,
  comment: z.string().trim().max(500).nullable().optional(),
});

export async function saveCheckin(input: z.input<typeof checkinSchema>): Promise<ActionResult<{ total: number }>> {
  const user = await requireUser();
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Completa los seis ítems con valores de 1 a 7" };
  const s = await athleteSession(parsed.data.sessionId, user.id);
  if (!s) return { ok: false, error: "Sesión no encontrada" };
  const { sessionId, comment, ...v } = parsed.data;
  const total = v.sleepTime + v.sleepQuality + v.rest + v.pain + v.stress + v.nutrition;
  // Se registra con la fecha real en que se hizo el check-in.
  const date = fromISODate(todayISO());
  await prisma.wellnessCheckin.upsert({
    where: { athleteId_sessionId: { athleteId: user.id, sessionId } },
    create: { athleteId: user.id, sessionId, date, total, comment: comment || null, ...v },
    update: { total, comment: comment || null, ...v },
  });
  await ensureWorkout(sessionId, user.id, todayISO());
  revalidatePath(`/atleta/sesion/${sessionId}`);
  revalidatePath("/atleta");
  return { ok: true, data: { total } };
}

const setSchema = z.object({
  sessionId: z.string().min(1),
  prescriptionId: z.string().min(1),
  setNumber: z.number().int().min(1).max(30),
  reps: z.number().int().min(0).max(1000).nullable(),
  loadKg: z.number().min(0).max(1000).nullable(),
  seconds: z.number().int().min(0).max(36000).nullable(),
  // Obsoleto: el RPE ahora es por ejercicio (logExerciseRpe). Se acepta para series que quedaron en cola offline.
  rpe: z.number().min(1).max(10).nullable().optional(),
  done: z.boolean(),
});

export type SetInput = z.input<typeof setSchema>;

/** Prescripción válida dentro de una sesión del atleta; devuelve el registro de la sesión (lo crea si falta). */
async function workoutFor(userId: string, sessionId: string, prescriptionId: string) {
  const s = await athleteSession(sessionId, userId);
  if (!s) return { error: "Sesión no encontrada" } as const;
  const prescription = await prisma.prescription.findFirst({ where: { id: prescriptionId, block: { sessionId } }, select: { id: true } });
  if (!prescription) return { error: "Ejercicio no encontrado" } as const;
  return { workout: await ensureWorkout(sessionId, userId, todayISO()) } as const;
}

/** Guarda una serie. Es idempotente (upsert por serie), así la cola offline puede reintentar sin duplicar. */
export async function logSet(input: SetInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = setSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos de la serie inválidos" };
  const d = parsed.data;
  const found = await workoutFor(user.id, d.sessionId, d.prescriptionId);
  if (found.error !== undefined) return { ok: false, error: found.error };
  const values = { reps: d.reps, loadKg: d.loadKg, seconds: d.seconds, done: d.done, ...(d.rpe !== undefined ? { rpe: d.rpe } : {}) };
  await prisma.setLog.upsert({
    where: { workoutLogId_prescriptionId_setNumber: { workoutLogId: found.workout.id, prescriptionId: d.prescriptionId, setNumber: d.setNumber } },
    create: { workoutLogId: found.workout.id, prescriptionId: d.prescriptionId, setNumber: d.setNumber, ...values },
    update: values,
  });
  return { ok: true };
}

const exerciseRpeSchema = z.object({
  sessionId: z.string().min(1),
  prescriptionId: z.string().min(1),
  rpe: z.number().min(1).max(10).nullable(),
});

export type ExerciseRpeInput = z.input<typeof exerciseRpeSchema>;

/** RPE del ejercicio completo (una vez por ejercicio). Idempotente, igual que logSet. */
export async function logExerciseRpe(input: ExerciseRpeInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = exerciseRpeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "RPE inválido" };
  const d = parsed.data;
  const found = await workoutFor(user.id, d.sessionId, d.prescriptionId);
  if (found.error !== undefined) return { ok: false, error: found.error };
  await prisma.exerciseLog.upsert({
    where: { workoutLogId_prescriptionId: { workoutLogId: found.workout.id, prescriptionId: d.prescriptionId } },
    create: { workoutLogId: found.workout.id, prescriptionId: d.prescriptionId, rpe: d.rpe },
    update: { rpe: d.rpe },
  });
  return { ok: true };
}

const finishSchema = z.object({
  sessionId: z.string().min(1),
  sessionRpe: z.number().min(1).max(10),
  durationMin: z.number().int().min(1).max(600).nullable(),
  comment: z.string().trim().max(2000).nullable().optional(),
});

export async function finishWorkout(input: z.input<typeof finishSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = finishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Indica el RPE de la sesión (1 a 10)" };
  const d = parsed.data;
  const s = await athleteSession(d.sessionId, user.id);
  if (!s) return { ok: false, error: "Sesión no encontrada" };
  const workout = await ensureWorkout(d.sessionId, user.id, todayISO());
  const minutes = d.durationMin ?? Math.max(1, Math.round((Date.now() - workout.startedAt.getTime()) / 60000));
  await prisma.workoutLog.update({
    where: { id: workout.id },
    data: { sessionRpe: d.sessionRpe, durationMin: Math.min(minutes, 600), comment: d.comment || null, completedAt: new Date() },
  });
  revalidatePath("/atleta");
  revalidatePath(`/atleta/sesion/${d.sessionId}`);
  revalidatePath("/coach");
  return { ok: true };
}

export async function reopenWorkout(sessionId: string): Promise<ActionResult> {
  const user = await requireUser();
  const s = await athleteSession(sessionId, user.id);
  if (!s) return { ok: false, error: "Sesión no encontrada" };
  await prisma.workoutLog.updateMany({ where: { sessionId, athleteId: user.id }, data: { completedAt: null } });
  revalidatePath(`/atleta/sesion/${sessionId}`);
  return { ok: true };
}
