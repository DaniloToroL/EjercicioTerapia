import "server-only";
import { toISODate } from "@/lib/dates";
import { estimate1RM, evaluateWellness } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { exerciseSelect, getWellnessThresholds } from "@/lib/queries";
import { computeSchedule } from "@/lib/schedule";

/** Todo lo necesario para ejecutar una sesión desde el teléfono. */
export async function getSessionView(sessionId: string, athleteId: string, orgId: string) {
  const session = await prisma.trainingSession.findFirst({
    where: { id: sessionId, microcycle: { mesocycle: { program: { athleteId, isTemplate: false } } } },
    include: {
      microcycle: {
        select: {
          name: true,
          objective: true,
          mesocycle: {
            select: {
              name: true,
              program: {
                select: {
                  id: true,
                  name: true,
                  startDate: true,
                  mesocycles: { select: { order: true, microcycles: { select: { id: true, order: true, sessions: { select: { id: true, weekday: true } } } } } },
                },
              },
            },
          },
        },
      },
      blocks: {
        orderBy: { order: "asc" },
        include: { items: { orderBy: { order: "asc" }, include: { exercise: { select: exerciseSelect } } } },
      },
    },
  });
  if (!session) return null;

  const program = session.microcycle.mesocycle.program;
  const date = computeSchedule(program).bySession.get(session.id)?.date ?? null;

  const [workout, checkin, thresholds] = await Promise.all([
    prisma.workoutLog.findUnique({
      where: { sessionId_athleteId: { sessionId, athleteId } },
      include: { sets: true },
    }),
    prisma.wellnessCheckin.findUnique({ where: { athleteId_sessionId: { athleteId, sessionId } } }),
    getWellnessThresholds(orgId),
  ]);

  // Historial por ejercicio: última vez que se hizo (fuera de esta sesión) y mejor 1RM estimado.
  const exerciseIds = [...new Set(session.blocks.flatMap((b) => b.items.map((i) => i.exerciseId)))];
  const history = await prisma.setLog.findMany({
    where: {
      done: true,
      workout: { athleteId, NOT: { sessionId } },
      prescription: { exerciseId: { in: exerciseIds } },
    },
    orderBy: { workout: { date: "desc" } },
    take: 600,
    select: {
      reps: true,
      loadKg: true,
      seconds: true,
      rpe: true,
      setNumber: true,
      workout: { select: { id: true, date: true } },
      prescription: { select: { exerciseId: true } },
    },
  });

  const lastByExercise: Record<string, { date: string; sets: { reps: number | null; loadKg: number | null; seconds: number | null; rpe: number | null }[] }> = {};
  const best1RM: Record<string, number> = {};
  for (const h of history) {
    const exId = h.prescription.exerciseId;
    const d = toISODate(h.workout.date);
    if (!lastByExercise[exId]) lastByExercise[exId] = { date: d, sets: [] };
    if (lastByExercise[exId].date === d) lastByExercise[exId].sets.push({ reps: h.reps, loadKg: h.loadKg, seconds: h.seconds, rpe: h.rpe });
    const e = estimate1RM(h.loadKg, h.reps, h.rpe);
    if (e && e > (best1RM[exId] ?? 0)) best1RM[exId] = e;
  }

  return {
    session: {
      id: session.id,
      name: session.name,
      color: session.color,
      notes: session.notes,
      blocks: session.blocks,
    },
    date,
    programName: program.name,
    mesocycleName: session.microcycle.mesocycle.name,
    microcycleName: session.microcycle.name,
    objective: session.microcycle.objective,
    workout: workout
      ? {
          startedAt: workout.startedAt.toISOString(),
          completedAt: workout.completedAt?.toISOString() ?? null,
          sessionRpe: workout.sessionRpe,
          durationMin: workout.durationMin,
          comment: workout.comment,
          sets: workout.sets.map((s) => ({
            prescriptionId: s.prescriptionId,
            setNumber: s.setNumber,
            reps: s.reps,
            loadKg: s.loadKg,
            seconds: s.seconds,
            rpe: s.rpe,
            done: s.done,
          })),
        }
      : null,
    checkin: checkin
      ? {
          values: {
            sleepTime: checkin.sleepTime,
            sleepQuality: checkin.sleepQuality,
            rest: checkin.rest,
            pain: checkin.pain,
            stress: checkin.stress,
            nutrition: checkin.nutrition,
          },
          total: checkin.total,
          result: evaluateWellness(checkin.total, thresholds),
        }
      : null,
    thresholds,
    lastByExercise,
    best1RM,
  };
}

export type SessionView = NonNullable<Awaited<ReturnType<typeof getSessionView>>>;
