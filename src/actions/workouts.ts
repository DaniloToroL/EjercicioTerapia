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
  rpe: z.number().min(1).max(10).nullable(),
  done: z.boolean(),
});

export type SetInput = z.input<typeof setSchema>;

/** Guarda una serie. Es idempotente (upsert por serie), así la cola offline puede reintentar sin duplicar. */
export async function logSet(input: SetInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = setSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos de la serie inválidos" };
  const d = parsed.data;
  const s = await athleteSession(d.sessionId, user.id);
  if (!s) return { ok: false, error: "Sesión no encontrada" };
  const prescription = await prisma.prescription.findFirst({ where: { id: d.prescriptionId, block: { sessionId: d.sessionId } }, select: { id: true } });
  if (!prescription) return { ok: false, error: "Ejercicio no encontrado" };
  const workout = await ensureWorkout(d.sessionId, user.id, todayISO());
  const values = { reps: d.reps, loadKg: d.loadKg, seconds: d.seconds, rpe: d.rpe, done: d.done };
  await prisma.setLog.upsert({
    where: { workoutLogId_prescriptionId_setNumber: { workoutLogId: workout.id, prescriptionId: d.prescriptionId, setNumber: d.setNumber } },
    create: { workoutLogId: workout.id, prescriptionId: d.prescriptionId, setNumber: d.setNumber, ...values },
    update: values,
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
