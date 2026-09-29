"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/actions/auth";
import type { Prisma } from "@/generated/prisma/client";
import { MesocycleGoal } from "@/generated/prisma/enums";
import { requireCoach } from "@/lib/auth";
import { DEFAULT_SESSION_BLOCKS, GOAL_DEFAULTS, SESSION_COLOR_ORDER } from "@/lib/constants";
import { fromISODate, mondayOf } from "@/lib/dates";
import { parseReps } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { programInclude, type FullProgram } from "@/lib/queries";

type Tx = Prisma.TransactionClient;
type FullMeso = FullProgram["mesocycles"][number];
type FullMicro = FullMeso["microcycles"][number];
type FullSession = FullMicro["sessions"][number];

const DAY_PRESETS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 4, 5],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

function revalidateProgram(programId: string) {
  revalidatePath(`/coach/programas/${programId}`);
  revalidatePath("/coach/programas");
}

// ---------- Verificación de pertenencia a la organización ----------

async function ownedProgram(id: string, orgId: string) {
  return prisma.program.findFirst({ where: { id, orgId }, select: { id: true } });
}
async function ownedMesocycle(id: string, orgId: string) {
  return prisma.mesocycle.findFirst({ where: { id, program: { orgId } }, select: { id: true, programId: true, goal: true } });
}
async function ownedMicrocycle(id: string, orgId: string) {
  return prisma.microcycle.findFirst({
    where: { id, mesocycle: { program: { orgId } } },
    select: { id: true, mesocycleId: true, order: true, mesocycle: { select: { programId: true } } },
  });
}
async function ownedSession(id: string, orgId: string) {
  return prisma.trainingSession.findFirst({
    where: { id, microcycle: { mesocycle: { program: { orgId } } } },
    select: { id: true, microcycleId: true, microcycle: { select: { mesocycle: { select: { programId: true, goal: true } } } } },
  });
}
async function ownedBlock(id: string, orgId: string) {
  return prisma.sessionBlock.findFirst({
    where: { id, session: { microcycle: { mesocycle: { program: { orgId } } } } },
    select: {
      id: true,
      sessionId: true,
      session: { select: { microcycle: { select: { mesocycle: { select: { programId: true, goal: true } } } } } },
    },
  });
}
async function ownedPrescription(id: string, orgId: string) {
  return prisma.prescription.findFirst({
    where: { id, block: { session: { microcycle: { mesocycle: { program: { orgId } } } } } },
    select: { id: true, blockId: true, order: true, block: { select: { session: { select: { microcycle: { select: { mesocycle: { select: { programId: true } } } } } } } } },
  });
}

// ---------- Copia profunda ----------

export type Progression = { addKg?: number; addReps?: number; addSets?: number; addRpe?: number };

function progressReps(text: string | null, add: number) {
  if (!text || !add) return text;
  const range = text.match(/^(\d+)(\s*(?:a|-|al)\s*)(\d+)(.*)$/);
  if (range) return `${Number(range[1]) + add}${range[2]}${Number(range[3]) + add}${range[4]}`;
  const single = text.match(/^(\d+)(.*)$/);
  if (single) return `${Number(single[1]) + add}${single[2]}`;
  return text;
}

function prescriptionData(p: FullSession["blocks"][number]["items"][number], prog?: Progression) {
  const repsText = progressReps(p.repsText, prog?.addReps ?? 0);
  const { repsMin, repsMax } = parseReps(repsText);
  return {
    exerciseId: p.exerciseId,
    order: p.order,
    group: p.group,
    sets: Math.max(1, p.sets + (prog?.addSets ?? 0)),
    repsText,
    repsMin,
    repsMax,
    loadKg: p.loadKg != null && prog?.addKg ? Math.round((p.loadKg + prog.addKg) * 100) / 100 : p.loadKg,
    loadPct: p.loadPct,
    rpeTarget: p.rpeTarget != null && prog?.addRpe ? Math.min(10, Math.max(1, p.rpeTarget + prog.addRpe)) : p.rpeTarget,
    tempo: p.tempo,
    restSec: p.restSec,
    notes: p.notes,
  };
}

function sessionCreateData(s: FullSession, prog?: Progression, overrides?: { order?: number; weekday?: number }) {
  return {
    order: overrides?.order ?? s.order,
    weekday: overrides?.weekday ?? s.weekday,
    name: s.name,
    color: s.color,
    notes: s.notes,
    blocks: {
      create: s.blocks.map((b) => ({
        blockTypeId: b.blockTypeId,
        title: b.title,
        order: b.order,
        items: { create: b.items.map((p) => prescriptionData(p, prog)) },
      })),
    },
  };
}

function microCreateData(m: FullMicro, prog?: Progression, overrides?: { order?: number; name?: string }) {
  return {
    order: overrides?.order ?? m.order,
    name: overrides?.name ?? m.name,
    objective: m.objective,
    sessions: { create: m.sessions.map((s) => sessionCreateData(s, prog)) },
  };
}

async function copyProgram(tx: Tx, source: FullProgram, data: { isTemplate: boolean; athleteId: string | null; startDate: Date | null; name: string; coachId: string }) {
  return tx.program.create({
    data: {
      orgId: source.orgId,
      coachId: data.coachId,
      athleteId: data.athleteId,
      isTemplate: data.isTemplate,
      name: data.name,
      description: source.description,
      startDate: data.startDate,
      mesocycles: {
        create: source.mesocycles.map((meso) => ({
          order: meso.order,
          name: meso.name,
          goal: meso.goal,
          notes: meso.notes,
          microcycles: { create: meso.microcycles.map((m) => microCreateData(m)) },
        })),
      },
    },
  });
}

async function defaultBlocks(orgId: string) {
  const types = await prisma.blockType.findMany({ where: { orgId, archived: false }, orderBy: { order: "asc" } });
  return DEFAULT_SESSION_BLOCKS.map((key) => types.find((t) => t.key === key)).filter((t): t is NonNullable<typeof t> => !!t);
}

function emptySessions(days: number[], blocks: { id: string; name: string }[], startOrder = 0) {
  return days.map((weekday, i) => ({
    order: startOrder + i,
    weekday,
    name: `Día ${startOrder + i + 1}`,
    color: SESSION_COLOR_ORDER[(startOrder + i) % SESSION_COLOR_ORDER.length],
    blocks: { create: blocks.map((b, j) => ({ blockTypeId: b.id, title: b.name, order: j })) },
  }));
}

// ---------- Programa ----------

const createProgramSchema = z.object({
  name: z.string().trim().min(2, "Ingresa un nombre"),
  isTemplate: z.boolean(),
  athleteId: z.string().nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  goal: z.enum(MesocycleGoal),
  mesocycleName: z.string().trim().optional(),
  weeks: z.number().int().min(1).max(12),
  daysPerWeek: z.number().int().min(1).max(7),
});

export async function createProgram(input: z.input<typeof createProgramSchema>): Promise<ActionResult<{ id: string }>> {
  const coach = await requireCoach();
  const parsed = createProgramSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!d.isTemplate && !d.athleteId) return { ok: false, error: "Selecciona un atleta o márcalo como plantilla" };
  if (d.athleteId && !(await prisma.user.findFirst({ where: { id: d.athleteId, orgId: coach.orgId } }))) {
    return { ok: false, error: "Atleta no encontrado" };
  }
  const blocks = await defaultBlocks(coach.orgId);
  const days = DAY_PRESETS[d.daysPerWeek];
  const program = await prisma.program.create({
    data: {
      orgId: coach.orgId,
      coachId: coach.id,
      athleteId: d.isTemplate ? null : d.athleteId,
      isTemplate: d.isTemplate,
      name: d.name,
      startDate: d.startDate && !d.isTemplate ? fromISODate(mondayOf(d.startDate)) : null,
      mesocycles: {
        create: {
          order: 0,
          name: d.mesocycleName || `Mesociclo 1: ${GOAL_DEFAULTS[d.goal].label}`,
          goal: d.goal,
          microcycles: {
            create: Array.from({ length: d.weeks }, (_, i) => ({
              order: i,
              name: `Semana ${i + 1}`,
              sessions: { create: emptySessions(days, blocks) },
            })),
          },
        },
      },
    },
  });
  revalidatePath("/coach/programas");
  return { ok: true, data: { id: program.id } };
}

const updateProgramSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  athleteId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function updateProgram(id: string, input: z.input<typeof updateProgramSchema>): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = updateProgramSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!(await ownedProgram(id, coach.orgId))) return { ok: false, error: "Programa no encontrado" };
  const { startDate, athleteId, ...rest } = parsed.data;
  if (athleteId && !(await prisma.user.findFirst({ where: { id: athleteId, orgId: coach.orgId } }))) {
    return { ok: false, error: "Atleta no encontrado" };
  }
  await prisma.program.update({
    where: { id },
    data: {
      ...rest,
      ...(startDate !== undefined ? { startDate: startDate ? fromISODate(mondayOf(startDate)) : null } : {}),
      ...(athleteId !== undefined ? { athleteId } : {}),
    },
  });
  revalidateProgram(id);
  return { ok: true };
}

export async function deleteProgram(id: string) {
  const coach = await requireCoach();
  if (!(await ownedProgram(id, coach.orgId))) return;
  const hasLogs = await prisma.workoutLog.count({ where: { session: { microcycle: { mesocycle: { programId: id } } } } });
  if (hasLogs > 0) {
    // Con registros del atleta no se borra: se archiva para no perder el historial.
    await prisma.program.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.program.delete({ where: { id } });
  }
  revalidatePath("/coach/programas");
  redirect("/coach/programas");
}

/** Asigna una plantilla (o copia un programa) a un atleta desde una fecha. */
export async function assignProgram(input: { sourceId: string; athleteId: string; startDate: string; name?: string }): Promise<ActionResult<{ id: string }>> {
  const coach = await requireCoach();
  const source = await prisma.program.findFirst({ where: { id: input.sourceId, orgId: coach.orgId }, include: programInclude });
  if (!source) return { ok: false, error: "Programa no encontrado" };
  const athlete = await prisma.user.findFirst({ where: { id: input.athleteId, orgId: coach.orgId } });
  if (!athlete) return { ok: false, error: "Atleta no encontrado" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) return { ok: false, error: "Fecha inválida" };
  const created = await prisma.$transaction((tx) =>
    copyProgram(tx, source, {
      isTemplate: false,
      athleteId: athlete.id,
      startDate: fromISODate(mondayOf(input.startDate)),
      name: input.name?.trim() || source.name,
      coachId: coach.id,
    }),
  );
  revalidatePath("/coach/programas");
  revalidatePath(`/coach/atletas/${athlete.id}`);
  return { ok: true, data: { id: created.id } };
}

export async function saveAsTemplate(programId: string, name?: string): Promise<ActionResult<{ id: string }>> {
  const coach = await requireCoach();
  const source = await prisma.program.findFirst({ where: { id: programId, orgId: coach.orgId }, include: programInclude });
  if (!source) return { ok: false, error: "Programa no encontrado" };
  const created = await prisma.$transaction((tx) =>
    copyProgram(tx, source, { isTemplate: true, athleteId: null, startDate: null, name: name?.trim() || `${source.name} (plantilla)`, coachId: coach.id }),
  );
  revalidatePath("/coach/programas");
  return { ok: true, data: { id: created.id } };
}

// ---------- Mesociclos ----------

export async function addMesocycle(programId: string, input: { name?: string; goal: MesocycleGoal; weeks: number; copyLastWeek?: boolean; progression?: Progression }): Promise<ActionResult> {
  const coach = await requireCoach();
  if (!(await ownedProgram(programId, coach.orgId))) return { ok: false, error: "Programa no encontrado" };
  const weeks = Math.min(12, Math.max(1, Math.round(input.weeks)));
  const program = await prisma.program.findUniqueOrThrow({ where: { id: programId }, include: programInclude });
  const order = program.mesocycles.length ? Math.max(...program.mesocycles.map((m) => m.order)) + 1 : 0;
  const lastMeso = program.mesocycles.at(-1);
  const lastWeek = lastMeso?.microcycles.at(-1);
  const name = input.name?.trim() || `Mesociclo ${order + 1}: ${GOAL_DEFAULTS[input.goal].label}`;

  let micros;
  if (input.copyLastWeek && lastWeek) {
    micros = Array.from({ length: weeks }, (_, i) => {
      const step: Progression = {
        addKg: (input.progression?.addKg ?? 0) * (i + 1),
        addReps: (input.progression?.addReps ?? 0) * (i + 1),
        addSets: (input.progression?.addSets ?? 0) * (i + 1),
        addRpe: (input.progression?.addRpe ?? 0) * (i + 1),
      };
      return microCreateData(lastWeek, step, { order: i, name: `Semana ${i + 1}` });
    });
  } else {
    const blocks = await defaultBlocks(coach.orgId);
    const days = lastWeek?.sessions.map((s) => s.weekday) ?? DAY_PRESETS[4];
    micros = Array.from({ length: weeks }, (_, i) => ({ order: i, name: `Semana ${i + 1}`, sessions: { create: emptySessions(days, blocks) } }));
  }
  await prisma.mesocycle.create({ data: { programId, order, name, goal: input.goal, microcycles: { create: micros } } });
  revalidateProgram(programId);
  return { ok: true };
}

export async function updateMesocycle(id: string, input: { name?: string; goal?: MesocycleGoal; notes?: string | null }): Promise<ActionResult> {
  const coach = await requireCoach();
  const meso = await ownedMesocycle(id, coach.orgId);
  if (!meso) return { ok: false, error: "Mesociclo no encontrado" };
  const goal = input.goal && Object.values(MesocycleGoal).includes(input.goal) ? input.goal : undefined;
  await prisma.mesocycle.update({ where: { id }, data: { name: input.name?.trim() || undefined, goal, notes: input.notes } });
  revalidateProgram(meso.programId);
  return { ok: true };
}

export async function deleteMesocycle(id: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const meso = await ownedMesocycle(id, coach.orgId);
  if (!meso) return { ok: false, error: "Mesociclo no encontrado" };
  const count = await prisma.mesocycle.count({ where: { programId: meso.programId } });
  if (count <= 1) return { ok: false, error: "El programa debe tener al menos un mesociclo" };
  const logs = await prisma.workoutLog.count({ where: { session: { microcycle: { mesocycleId: id } } } });
  if (logs > 0) return { ok: false, error: "Este mesociclo tiene sesiones registradas por el atleta y no se puede borrar" };
  await prisma.mesocycle.delete({ where: { id } });
  revalidateProgram(meso.programId);
  return { ok: true };
}

// ---------- Microciclos (semanas) ----------

async function reorderMicrocycles(tx: Tx, mesocycleId: string) {
  const micros = await tx.microcycle.findMany({ where: { mesocycleId }, orderBy: { order: "asc" }, select: { id: true } });
  await Promise.all(micros.map((m, i) => tx.microcycle.update({ where: { id: m.id }, data: { order: i } })));
}

/** Duplica una semana a continuación, aplicando la progresión indicada. */
export async function duplicateMicrocycle(id: string, progression: Progression = {}): Promise<ActionResult<{ id: string }>> {
  const coach = await requireCoach();
  const owned = await ownedMicrocycle(id, coach.orgId);
  if (!owned) return { ok: false, error: "Semana no encontrada" };
  const program = await prisma.program.findUniqueOrThrow({ where: { id: owned.mesocycle.programId }, include: programInclude });
  const meso = program.mesocycles.find((m) => m.id === owned.mesocycleId)!;
  const micro = meso.microcycles.find((m) => m.id === id)!;
  const created = await prisma.$transaction(async (tx) => {
    await tx.microcycle.updateMany({ where: { mesocycleId: meso.id, order: { gt: micro.order } }, data: { order: { increment: 1 } } });
    // "Microciclo 7: Introductorio" pasa a "Microciclo 8: Introductorio"; sin número se marca como copia.
    const nextName = /\d+/.test(micro.name) ? micro.name.replace(/\d+/, (n) => String(Number(n) + 1)) : `${micro.name} (copia)`;
    const c = await tx.microcycle.create({ data: { mesocycleId: meso.id, ...microCreateData(micro, progression, { order: micro.order + 1, name: nextName }) } });
    await reorderMicrocycles(tx, meso.id);
    return c;
  });
  revalidateProgram(program.id);
  return { ok: true, data: { id: created.id } };
}

export async function addMicrocycle(mesocycleId: string): Promise<ActionResult<{ id: string }>> {
  const coach = await requireCoach();
  const meso = await ownedMesocycle(mesocycleId, coach.orgId);
  if (!meso) return { ok: false, error: "Mesociclo no encontrado" };
  const last = await prisma.microcycle.findFirst({ where: { mesocycleId }, orderBy: { order: "desc" }, include: { sessions: { select: { weekday: true } } } });
  const blocks = await defaultBlocks(coach.orgId);
  const order = (last?.order ?? -1) + 1;
  const days = last?.sessions.map((s) => s.weekday) ?? DAY_PRESETS[4];
  const created = await prisma.microcycle.create({
    data: { mesocycleId, order, name: `Semana ${order + 1}`, sessions: { create: emptySessions(days, blocks) } },
  });
  revalidateProgram(meso.programId);
  return { ok: true, data: { id: created.id } };
}

export async function updateMicrocycle(id: string, input: { name?: string; objective?: string | null }): Promise<ActionResult> {
  const coach = await requireCoach();
  const micro = await ownedMicrocycle(id, coach.orgId);
  if (!micro) return { ok: false, error: "Semana no encontrada" };
  await prisma.microcycle.update({ where: { id }, data: { name: input.name?.trim() || undefined, objective: input.objective } });
  revalidateProgram(micro.mesocycle.programId);
  return { ok: true };
}

export async function deleteMicrocycle(id: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const micro = await ownedMicrocycle(id, coach.orgId);
  if (!micro) return { ok: false, error: "Semana no encontrada" };
  const count = await prisma.microcycle.count({ where: { mesocycleId: micro.mesocycleId } });
  if (count <= 1) return { ok: false, error: "El mesociclo debe tener al menos una semana" };
  const logs = await prisma.workoutLog.count({ where: { session: { microcycleId: id } } });
  if (logs > 0) return { ok: false, error: "Esta semana tiene sesiones registradas y no se puede borrar" };
  await prisma.$transaction(async (tx) => {
    await tx.microcycle.delete({ where: { id } });
    await reorderMicrocycles(tx, micro.mesocycleId);
  });
  revalidateProgram(micro.mesocycle.programId);
  return { ok: true };
}

// ---------- Sesiones (días) ----------

export async function addSession(microcycleId: string, weekday: number): Promise<ActionResult> {
  const coach = await requireCoach();
  const micro = await ownedMicrocycle(microcycleId, coach.orgId);
  if (!micro) return { ok: false, error: "Semana no encontrada" };
  const count = await prisma.trainingSession.count({ where: { microcycleId } });
  const blocks = await defaultBlocks(coach.orgId);
  await prisma.trainingSession.create({ data: { microcycleId, ...emptySessions([Math.min(6, Math.max(0, weekday))], blocks, count)[0] } });
  revalidateProgram(micro.mesocycle.programId);
  return { ok: true };
}

export async function updateSession(id: string, input: { name?: string; weekday?: number; color?: string; notes?: string | null }): Promise<ActionResult> {
  const coach = await requireCoach();
  const s = await ownedSession(id, coach.orgId);
  if (!s) return { ok: false, error: "Sesión no encontrada" };
  await prisma.trainingSession.update({
    where: { id },
    data: {
      name: input.name?.trim() || undefined,
      weekday: input.weekday != null ? Math.min(6, Math.max(0, input.weekday)) : undefined,
      color: input.color,
      notes: input.notes,
    },
  });
  revalidateProgram(s.microcycle.mesocycle.programId);
  return { ok: true };
}

export async function deleteSession(id: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const s = await ownedSession(id, coach.orgId);
  if (!s) return { ok: false, error: "Sesión no encontrada" };
  const logs = await prisma.workoutLog.count({ where: { sessionId: id } });
  if (logs > 0) return { ok: false, error: "La sesión tiene registros del atleta y no se puede borrar" };
  await prisma.trainingSession.delete({ where: { id } });
  revalidateProgram(s.microcycle.mesocycle.programId);
  return { ok: true };
}

/** Copia un día dentro de la misma semana o a otra semana del programa. */
export async function duplicateSession(id: string, targetMicrocycleId?: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const s = await ownedSession(id, coach.orgId);
  if (!s) return { ok: false, error: "Sesión no encontrada" };
  const target = targetMicrocycleId ?? s.microcycleId;
  const targetMicro = await ownedMicrocycle(target, coach.orgId);
  if (!targetMicro || targetMicro.mesocycle.programId !== s.microcycle.mesocycle.programId) return { ok: false, error: "Semana de destino no válida" };
  const full = await prisma.trainingSession.findUniqueOrThrow({
    where: { id },
    include: programInclude.mesocycles.include.microcycles.include.sessions.include,
  });
  const count = await prisma.trainingSession.count({ where: { microcycleId: target } });
  await prisma.trainingSession.create({ data: { microcycleId: target, ...sessionCreateData(full as FullSession, undefined, { order: count }) } });
  revalidateProgram(s.microcycle.mesocycle.programId);
  return { ok: true };
}

export async function reorderSessions(microcycleId: string, orderedIds: string[]): Promise<ActionResult> {
  const coach = await requireCoach();
  const micro = await ownedMicrocycle(microcycleId, coach.orgId);
  if (!micro) return { ok: false, error: "Semana no encontrada" };
  await prisma.$transaction(orderedIds.map((sid, i) => prisma.trainingSession.updateMany({ where: { id: sid, microcycleId }, data: { order: i } })));
  revalidateProgram(micro.mesocycle.programId);
  return { ok: true };
}

// ---------- Bloques ----------

export async function addBlock(sessionId: string, blockTypeId: string | null, title?: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const s = await ownedSession(sessionId, coach.orgId);
  if (!s) return { ok: false, error: "Sesión no encontrada" };
  const type = blockTypeId ? await prisma.blockType.findFirst({ where: { id: blockTypeId, orgId: coach.orgId } }) : null;
  const last = await prisma.sessionBlock.findFirst({ where: { sessionId }, orderBy: { order: "desc" } });
  await prisma.sessionBlock.create({
    data: { sessionId, blockTypeId: type?.id ?? null, title: title?.trim() || type?.name || "Bloque", order: (last?.order ?? -1) + 1 },
  });
  revalidateProgram(s.microcycle.mesocycle.programId);
  return { ok: true };
}

export async function updateBlock(id: string, input: { title?: string }): Promise<ActionResult> {
  const coach = await requireCoach();
  const b = await ownedBlock(id, coach.orgId);
  if (!b) return { ok: false, error: "Bloque no encontrado" };
  await prisma.sessionBlock.update({ where: { id }, data: { title: input.title?.trim() || undefined } });
  revalidateProgram(b.session.microcycle.mesocycle.programId);
  return { ok: true };
}

export async function deleteBlock(id: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const b = await ownedBlock(id, coach.orgId);
  if (!b) return { ok: false, error: "Bloque no encontrado" };
  const logs = await prisma.setLog.count({ where: { prescription: { blockId: id } } });
  if (logs > 0) return { ok: false, error: "El bloque tiene series registradas y no se puede borrar" };
  await prisma.sessionBlock.delete({ where: { id } });
  revalidateProgram(b.session.microcycle.mesocycle.programId);
  return { ok: true };
}

export async function moveBlock(id: string, direction: -1 | 1): Promise<ActionResult> {
  const coach = await requireCoach();
  const b = await ownedBlock(id, coach.orgId);
  if (!b) return { ok: false, error: "Bloque no encontrado" };
  const blocks = await prisma.sessionBlock.findMany({ where: { sessionId: b.sessionId }, orderBy: { order: "asc" }, select: { id: true } });
  const i = blocks.findIndex((x) => x.id === id);
  const j = i + direction;
  if (j < 0 || j >= blocks.length) return { ok: true };
  [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  await prisma.$transaction(blocks.map((x, k) => prisma.sessionBlock.update({ where: { id: x.id }, data: { order: k } })));
  revalidateProgram(b.session.microcycle.mesocycle.programId);
  return { ok: true };
}

// ---------- Ejercicios prescritos ----------

export async function addPrescription(blockId: string, exerciseId: string, index?: number): Promise<ActionResult<{ id: string }>> {
  const coach = await requireCoach();
  const b = await ownedBlock(blockId, coach.orgId);
  if (!b) return { ok: false, error: "Bloque no encontrado" };
  const exercise = await prisma.exercise.findFirst({ where: { id: exerciseId, OR: [{ orgId: coach.orgId }, { orgId: null }] } });
  if (!exercise) return { ok: false, error: "Ejercicio no encontrado" };
  const defaults = GOAL_DEFAULTS[b.session.microcycle.mesocycle.goal];
  const isLoaded = exercise.loadType === "EXTERNAL";
  const repsText = exercise.loadType === "TIME" ? "30\"" : defaults.repsText;
  const created = await prisma.$transaction(async (tx) => {
    const count = await tx.prescription.count({ where: { blockId } });
    const at = index == null ? count : Math.max(0, Math.min(index, count));
    await tx.prescription.updateMany({ where: { blockId, order: { gte: at } }, data: { order: { increment: 1 } } });
    return tx.prescription.create({
      data: {
        blockId,
        exerciseId,
        order: at,
        sets: defaults.sets,
        repsText,
        ...parseReps(repsText),
        rpeTarget: isLoaded ? defaults.rpe : null,
      },
    });
  });
  revalidateProgram(b.session.microcycle.mesocycle.programId);
  return { ok: true, data: { id: created.id } };
}

const prescriptionSchema = z.object({
  sets: z.number().int().min(1).max(20).optional(),
  repsText: z.string().trim().max(40).nullable().optional(),
  loadKg: z.number().min(0).max(1000).nullable().optional(),
  loadPct: z.number().min(1).max(120).nullable().optional(),
  rpeTarget: z.number().min(1).max(10).nullable().optional(),
  tempo: z.string().trim().max(20).nullable().optional(),
  restSec: z.number().int().min(0).max(1800).nullable().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
  group: z.string().trim().max(3).nullable().optional(),
});

export async function updatePrescription(id: string, input: z.input<typeof prescriptionSchema>): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = prescriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const p = await ownedPrescription(id, coach.orgId);
  if (!p) return { ok: false, error: "Ejercicio no encontrado" };
  const data: Prisma.PrescriptionUpdateInput = { ...parsed.data };
  if (parsed.data.repsText !== undefined) Object.assign(data, parseReps(parsed.data.repsText));
  await prisma.prescription.update({ where: { id }, data });
  revalidateProgram(p.block.session.microcycle.mesocycle.programId);
  return { ok: true };
}

export async function replacePrescriptionExercise(id: string, exerciseId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const p = await ownedPrescription(id, coach.orgId);
  if (!p) return { ok: false, error: "Ejercicio no encontrado" };
  const exercise = await prisma.exercise.findFirst({ where: { id: exerciseId, OR: [{ orgId: coach.orgId }, { orgId: null }] } });
  if (!exercise) return { ok: false, error: "Ejercicio no encontrado" };
  await prisma.prescription.update({ where: { id }, data: { exerciseId } });
  revalidateProgram(p.block.session.microcycle.mesocycle.programId);
  return { ok: true };
}

export async function deletePrescription(id: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const p = await ownedPrescription(id, coach.orgId);
  if (!p) return { ok: false, error: "Ejercicio no encontrado" };
  const logs = await prisma.setLog.count({ where: { prescriptionId: id } });
  if (logs > 0) return { ok: false, error: "Este ejercicio tiene series registradas por el atleta y no se puede borrar" };
  await prisma.$transaction(async (tx) => {
    await tx.prescription.delete({ where: { id } });
    await tx.prescription.updateMany({ where: { blockId: p.blockId, order: { gt: p.order } }, data: { order: { decrement: 1 } } });
  });
  revalidateProgram(p.block.session.microcycle.mesocycle.programId);
  return { ok: true };
}

/** Mueve un ejercicio a otra posición, en el mismo bloque o en otro de la misma semana o programa. */
export async function movePrescription(id: string, toBlockId: string, toIndex: number): Promise<ActionResult> {
  const coach = await requireCoach();
  const p = await ownedPrescription(id, coach.orgId);
  const target = await ownedBlock(toBlockId, coach.orgId);
  if (!p || !target) return { ok: false, error: "Ejercicio o bloque no encontrado" };
  if (p.block.session.microcycle.mesocycle.programId !== target.session.microcycle.mesocycle.programId) {
    return { ok: false, error: "No se puede mover entre programas" };
  }
  await prisma.$transaction(async (tx) => {
    const source = await tx.prescription.findMany({ where: { blockId: p.blockId, NOT: { id } }, orderBy: { order: "asc" }, select: { id: true } });
    const dest = p.blockId === toBlockId ? source : await tx.prescription.findMany({ where: { blockId: toBlockId }, orderBy: { order: "asc" }, select: { id: true } });
    const at = Math.max(0, Math.min(toIndex, dest.length));
    const newDest = [...dest.slice(0, at), { id }, ...dest.slice(at)];
    if (p.blockId !== toBlockId) {
      for (const [i, x] of source.entries()) await tx.prescription.update({ where: { id: x.id }, data: { order: i } });
    }
    for (const [i, x] of newDest.entries()) {
      await tx.prescription.update({ where: { id: x.id }, data: { order: i, ...(x.id === id ? { blockId: toBlockId } : {}) } });
    }
  });
  revalidateProgram(p.block.session.microcycle.mesocycle.programId);
  return { ok: true };
}
