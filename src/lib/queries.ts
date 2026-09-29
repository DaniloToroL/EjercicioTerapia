import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { addDaysISO, mondayOf, toISODate, todayISO } from "@/lib/dates";
import { estimate1RM, evaluateWellness, parseThresholds, sessionLoad, setVolume } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { computeSchedule } from "@/lib/schedule";

export const exerciseSelect = {
  id: true,
  name: true,
  nameEn: true,
  videoProvider: true,
  videoUrl: true,
  thumbnailUrl: true,
  loadType: true,
  pattern: true,
  equipment: true,
  instructions: true,
  unilateral: true,
} satisfies Prisma.ExerciseSelect;

export const programInclude = {
  athlete: { select: { id: true, name: true } },
  mesocycles: {
    orderBy: { order: "asc" },
    include: {
      microcycles: {
        orderBy: { order: "asc" },
        include: {
          sessions: {
            orderBy: [{ order: "asc" }],
            include: {
              blocks: {
                orderBy: { order: "asc" },
                include: {
                  items: { orderBy: { order: "asc" }, include: { exercise: { select: exerciseSelect } } },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ProgramInclude;

export type FullProgram = Prisma.ProgramGetPayload<{ include: typeof programInclude }>;
export type FullSession = FullProgram["mesocycles"][number]["microcycles"][number]["sessions"][number];

export async function getProgramFull(programId: string, orgId: string) {
  return prisma.program.findFirst({ where: { id: programId, orgId }, include: programInclude });
}

export async function getWellnessThresholds(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { wellnessThresholds: true } });
  return parseThresholds(org?.wellnessThresholds);
}

export type ScheduledSession = {
  session: FullSession;
  date: string | null;
  programId: string;
  programName: string;
  mesocycleName: string;
  microcycleName: string;
  microcycleObjective: string | null;
};

/** Todas las sesiones de los programas activos de un atleta, con su fecha calculada. */
export async function getAthleteSchedule(athleteId: string) {
  const programs = await prisma.program.findMany({
    where: { athleteId, active: true, isTemplate: false },
    include: programInclude,
    orderBy: { startDate: "asc" },
  });
  const sessions: ScheduledSession[] = [];
  for (const program of programs) {
    const { bySession } = computeSchedule(program);
    for (const meso of program.mesocycles) {
      for (const micro of meso.microcycles) {
        for (const session of micro.sessions) {
          sessions.push({
            session,
            date: bySession.get(session.id)?.date ?? null,
            programId: program.id,
            programName: program.name,
            mesocycleName: meso.name,
            microcycleName: micro.name,
            microcycleObjective: micro.objective,
          });
        }
      }
    }
  }
  sessions.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.session.order - b.session.order);
  return sessions;
}

/** Vista general de atletas para el tablero del entrenador. */
export async function getAthletesOverview(orgId: string, coachId: string) {
  const thresholds = await getWellnessThresholds(orgId);
  const today = todayISO();
  const weekStart = mondayOf(today);
  const weekEnd = addDaysISO(weekStart, 6);

  const athletes = await prisma.user.findMany({
    where: {
      orgId,
      OR: [{ role: "ATHLETE" }, { id: coachId, programs: { some: { active: true } } }],
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      passwordHash: true,
      accessToken: true,
      accessMode: true,
      checkins: { orderBy: { date: "desc" }, take: 1, select: { date: true, total: true } },
      workouts: {
        orderBy: { date: "desc" },
        take: 20,
        select: {
          date: true,
          completedAt: true,
          sessionRpe: true,
          sets: { select: { rpe: true, prescription: { select: { rpeTarget: true } } } },
        },
      },
    },
  });

  const result = [];
  for (const a of athletes) {
    const schedule = await getAthleteSchedule(a.id);
    const planned = schedule.filter((s) => s.date && s.date >= weekStart && s.date <= weekEnd);
    const doneThisWeek = a.workouts.filter((w) => w.completedAt && toISODate(w.date) >= weekStart && toISODate(w.date) <= weekEnd).length;
    const lastCheckin = a.checkins[0];
    const wellness = lastCheckin ? { ...evaluateWellness(lastCheckin.total, thresholds), total: lastCheckin.total, date: toISODate(lastCheckin.date) } : null;
    const lastWorkout = a.workouts.find((w) => w.completedAt);
    const recent = a.workouts.filter((w) => toISODate(w.date) >= addDaysISO(today, -7));
    const rpeOver = recent.some((w) => w.sets.some((s) => s.rpe != null && s.prescription.rpeTarget != null && s.rpe >= s.prescription.rpeTarget + 1.5));
    const nextSession = schedule.find((s) => s.date && s.date >= today);
    const alerts: string[] = [];
    if (wellness && (wellness.level === "warning" || wellness.level === "bad") && wellness.date >= addDaysISO(today, -3)) alerts.push("Regeneración baja");
    if (rpeOver) alerts.push("RPE sobre lo planificado");
    const missed = schedule.filter((s) => s.date && s.date < today && s.date >= addDaysISO(today, -7)).length - recent.filter((w) => w.completedAt).length;
    if (missed > 0) alerts.push(`${missed} sesión${missed > 1 ? "es" : ""} sin registrar`);
    result.push({
      id: a.id,
      name: a.name,
      email: a.email,
      isSelf: a.id === coachId,
      active: a.active,
      pendingInvite: a.role === "ATHLETE" && a.accessMode === "LOGIN" && !a.passwordHash,
      accessMode: a.accessMode,
      accessPath: a.role === "ATHLETE" && a.accessToken ? `/r/${a.accessToken}` : null,
      plannedThisWeek: planned.length,
      doneThisWeek,
      wellness,
      lastWorkoutDate: lastWorkout ? toISODate(lastWorkout.date) : null,
      nextSession: nextSession ? { date: nextSession.date, name: nextSession.session.name } : null,
      hasProgram: schedule.length > 0,
      alerts,
    });
  }
  return result;
}

/** Datos de progreso de un atleta: por ejercicio, por semana y regeneración. */
export async function getProgress(athleteId: string, orgId: string) {
  const thresholds = await getWellnessThresholds(orgId);
  const workouts = await prisma.workoutLog.findMany({
    where: { athleteId },
    orderBy: { date: "asc" },
    include: {
      session: { select: { name: true } },
      sets: {
        where: { done: true },
        include: {
          prescription: {
            select: {
              rpeTarget: true,
              loadKg: true,
              repsMax: true,
              block: { select: { title: true } },
              exercise: { select: { id: true, name: true, loadType: true, pattern: true } },
            },
          },
        },
      },
    },
  });
  const checkins = await prisma.wellnessCheckin.findMany({ where: { athleteId }, orderBy: { date: "asc" } });

  type ExerciseAgg = {
    id: string;
    name: string;
    loadType: string;
    points: Map<string, { date: string; e1rm: number | null; maxKg: number; tonnage: number; reps: number }>;
  };
  const byExercise = new Map<string, ExerciseAgg>();
  const byWeek = new Map<string, { week: string; tonnage: number; reps: number; contacts: number; seconds: number; sessions: number; load: number }>();
  const byWeekBlock = new Map<string, Map<string, number>>();

  for (const w of workouts) {
    const date = toISODate(w.date);
    const week = mondayOf(date);
    const wk = byWeek.get(week) ?? { week, tonnage: 0, reps: 0, contacts: 0, seconds: 0, sessions: 0, load: 0 };
    if (w.completedAt) wk.sessions++;
    wk.load += sessionLoad(w.sessionRpe, w.durationMin) ?? 0;
    const blocks = byWeekBlock.get(week) ?? new Map<string, number>();
    for (const s of w.sets) {
      const ex = s.prescription.exercise;
      const vol = setVolume(ex.loadType, s);
      wk.tonnage += vol.tonnage;
      wk.reps += vol.reps;
      wk.contacts += vol.contacts;
      wk.seconds += vol.seconds;
      blocks.set(s.prescription.block.title, (blocks.get(s.prescription.block.title) ?? 0) + vol.tonnage);

      const agg = byExercise.get(ex.id) ?? { id: ex.id, name: ex.name, loadType: ex.loadType, points: new Map() };
      const p = agg.points.get(date) ?? { date, e1rm: null, maxKg: 0, tonnage: 0, reps: 0 };
      const e = estimate1RM(s.loadKg, s.reps, s.rpe);
      if (e != null && (p.e1rm == null || e > p.e1rm)) p.e1rm = e;
      p.maxKg = Math.max(p.maxKg, s.loadKg ?? 0);
      p.tonnage += vol.tonnage;
      p.reps += vol.reps;
      agg.points.set(date, p);
      byExercise.set(ex.id, agg);
    }
    byWeek.set(week, wk);
    byWeekBlock.set(week, blocks);
  }

  const exercises = [...byExercise.values()]
    .map((e) => {
      const points = [...e.points.values()].sort((a, b) => a.date.localeCompare(b.date));
      const best = points.reduce((m, p) => Math.max(m, p.e1rm ?? 0), 0);
      const bestKg = points.reduce((m, p) => Math.max(m, p.maxKg), 0);
      return { id: e.id, name: e.name, loadType: e.loadType, points, best1RM: best || null, bestKg: bestKg || null, sessions: points.length };
    })
    .sort((a, b) => b.sessions - a.sessions);

  const weeks = [...byWeek.values()].sort((a, b) => a.week.localeCompare(b.week));
  const blockNames = new Set<string>();
  byWeekBlock.forEach((m) => m.forEach((_, k) => blockNames.add(k)));
  const weeklyBlocks = weeks.map((w) => {
    const row: Record<string, number | string> = { week: w.week };
    const m = byWeekBlock.get(w.week);
    blockNames.forEach((b) => (row[b] = Math.round(m?.get(b) ?? 0)));
    return row;
  });

  return {
    exercises,
    weeks,
    weeklyBlocks,
    blockNames: [...blockNames],
    wellness: checkins.map((c) => ({
      date: toISODate(c.date),
      total: c.total,
      sleepTime: c.sleepTime,
      sleepQuality: c.sleepQuality,
      rest: c.rest,
      pain: c.pain,
      stress: c.stress,
      nutrition: c.nutrition,
      level: evaluateWellness(c.total, thresholds).level,
    })),
    thresholds,
    totalWorkouts: workouts.filter((w) => w.completedAt).length,
  };
}

export type ProgressData = Awaited<ReturnType<typeof getProgress>>;
