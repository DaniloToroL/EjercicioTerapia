// Datos de demostración: réplica del "Microciclo 7: Introductorio" de la planilla,
// con tres semanas anteriores registradas para que el progreso tenga datos.
// Solo se crea si la base no tiene usuarios. Cuentas de prueba (solo desarrollo):
//   entrenador@demo.test y atleta@demo.test, contraseña SEED_DEMO_PASSWORD o "demo-entreno-2026".

import bcrypt from "bcryptjs";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { DEFAULT_BLOCK_TYPES, DEFAULT_WELLNESS_THRESHOLDS } from "../../src/lib/constants";
import { addDaysISO, fromISODate, mondayOf, todayISO } from "../../src/lib/dates";
import { parseReps } from "../../src/lib/metrics";

type Item = { ex: string; reps: string; sets: number; kg?: number; rpe?: number; notes?: string };
type Block = { key: string; title?: string; items: Item[] };
type Day = { name: string; weekday: number; color: string; blocks: Block[]; comment?: string };

const MICRO_7: Day[] = [
  {
    name: "Squat / Row",
    weekday: 0,
    color: "blue",
    blocks: [
      {
        key: "construccion",
        items: [
          { ex: "rock-back-hip-mob", reps: "10", sets: 1 },
          { ex: "half-kneeling-tspine-kb", reps: "14", sets: 1, kg: 16 },
          { ex: "tall-kneeling-kb-halo", reps: "14", sets: 1, kg: 16 },
          { ex: "half-kneeling-cable-chop", reps: "14", sets: 1, kg: 25 },
        ],
      },
      {
        key: "calentamiento",
        items: [
          { ex: "kick-flow", reps: "14", sets: 1 },
          { ex: "wall-drill-load-lift", reps: "14", sets: 1 },
          { ex: "pin-squat-quarter", reps: "3", sets: 1, kg: 120 },
        ],
      },
      { key: "pliometria", items: [{ ex: "depth-jump", reps: "6", sets: 2 }] },
      {
        key: "primario",
        items: [
          { ex: "pin-squat-quarter", reps: "4", sets: 1, kg: 130, rpe: 8 },
          { ex: "bb-squat-pause", reps: "12", sets: 2, kg: 90, rpe: 9 },
          { ex: "cars-escapular", reps: "5", sets: 1 },
        ],
      },
      {
        key: "secundario",
        items: [
          { ex: "2db-step-up", reps: "24", sets: 3, kg: 25, rpe: 9, notes: "12,5 kg por mano" },
          { ex: "upright-cable-row", reps: "12", sets: 3, kg: 45, rpe: 9 },
        ],
      },
      {
        key: "variabilidad",
        items: [
          { ex: "leg-extension", reps: "12", sets: 2, kg: 25 },
          { ex: "2db-curl-biceps", reps: "12", sets: 2, kg: 20, rpe: 6 },
        ],
      },
    ],
  },
  {
    name: "Bench press / RDL",
    weekday: 1,
    color: "green",
    blocks: [
      {
        key: "construccion",
        items: [
          { ex: "swimming-prone", reps: "10", sets: 2, notes: "1,25 kg por mano" },
          { ex: "shoulder-cars-half-kneeling", reps: "14", sets: 1 },
          { ex: "single-arm-plank", reps: '30"', sets: 2, notes: '30" por mano' },
        ],
      },
      {
        key: "calentamiento",
        items: [
          { ex: "push-up-tempo", reps: "8", sets: 1 },
          { ex: "shoulder-act-band", reps: "15", sets: 1 },
          { ex: "bb-bench-press-pause", reps: "6", sets: 1, kg: 60 },
        ],
      },
      { key: "potencia", items: [] },
      {
        key: "primario",
        items: [
          { ex: "bb-bench-press-pause", reps: "3", sets: 1, kg: 85 },
          { ex: "bb-bench-press-pause", reps: "12", sets: 2, kg: 70 },
        ],
      },
      {
        key: "secundario",
        items: [
          { ex: "bb-overhead-press", reps: "10", sets: 3, kg: 35 },
          { ex: "hip-thrust", reps: "10", sets: 3, kg: 50 },
        ],
      },
      {
        key: "variabilidad",
        items: [
          { ex: "2db-seated-arnold-press", reps: "12", sets: 3, kg: 30, notes: "12,5 kg por mano" },
          { ex: "seated-leg-curl", reps: "10", sets: 3, kg: 40 },
        ],
      },
    ],
  },
  {
    name: "DL / Push",
    weekday: 4,
    color: "red",
    blocks: [
      {
        key: "construccion",
        items: [
          { ex: "deep-squat-hamstring-stretch", reps: "14", sets: 1 },
          { ex: "kb-windmill-half-kneeling", reps: "14", sets: 1, kg: 10 },
          { ex: "march-glute", reps: "30", sets: 1 },
          { ex: "dns-star-pattern", reps: "14", sets: 1 },
        ],
      },
      {
        key: "calentamiento",
        items: [
          { ex: "push-up-tempo", reps: "8", sets: 1 },
          { ex: "shoulder-act-band", reps: "15", sets: 1 },
          { ex: "bb-hex-deadlift-pause", reps: "8", sets: 1, kg: 120 },
        ],
      },
      {
        key: "pliometria",
        items: [
          { ex: "front-monster-walk", reps: "80", sets: 2 },
          { ex: "deep-squat-spine-rotation", reps: "14", sets: 2 },
        ],
      },
      {
        key: "primario",
        items: [
          { ex: "bb-hex-deadlift-pause", reps: "5", sets: 1, kg: 150, rpe: 8 },
          { ex: "bb-hex-deadlift-pause", reps: "8", sets: 2, kg: 130, rpe: 9 },
        ],
      },
      {
        key: "secundario",
        items: [
          { ex: "bb-rdl", reps: "8", sets: 2, kg: 90, rpe: 8 },
          { ex: "scorpion-90", reps: "14", sets: 2 },
          { ex: "2db-seated-arnold-press", reps: "12", sets: 2, kg: 30, rpe: 9 },
        ],
      },
      { key: "variabilidad", items: [] },
    ],
  },
  {
    name: "Pull / Squat",
    weekday: 5,
    color: "black",
    comment: "Leg extension lo encuentro mega liviano jaja",
    blocks: [
      {
        key: "construccion",
        items: [
          { ex: "wall-slide", reps: "10", sets: 1, notes: "Rango cómodo, sin dolor" },
          { ex: "dorsiflex-kb", reps: "10", sets: 1, kg: 20, notes: "2 segundos adelante" },
          { ex: "bridge-glute-band", reps: "30", sets: 1 },
          { ex: "side-plank-hip-lift", reps: "30", sets: 1 },
        ],
      },
      {
        key: "calentamiento",
        items: [
          { ex: "banded-single-leg-airplane", reps: "20", sets: 1 },
          { ex: "hanging-scapular-cars", reps: "10", sets: 1 },
          { ex: "pull-up-escapular", reps: "10", sets: 1 },
          { ex: "pull-up-iso-hold", reps: '10"', sets: 1 },
        ],
      },
      { key: "pliometria", items: [] },
      {
        key: "primario",
        items: [
          { ex: "pull-up-lastrado", reps: "3", sets: 1, kg: 15, rpe: 8 },
          { ex: "pull-up", reps: "10", sets: 2, rpe: 9 },
        ],
      },
      {
        key: "secundario",
        items: [
          { ex: "bent-over-row", reps: "6", sets: 3, kg: 70 },
          { ex: "elevacion-talones", reps: "12", sets: 3, kg: 70 },
          { ex: "toe-squat", reps: "12", sets: 3, kg: 40, notes: "2 mancuernas de 20" },
        ],
      },
      {
        key: "variabilidad",
        items: [
          { ex: "2db-curl-biceps", reps: "12", sets: 2, kg: 30, rpe: 9, notes: "2 mancuernas de 15" },
          { ex: "leg-extension", reps: "12", sets: 2, kg: 30, rpe: 7 },
        ],
      },
    ],
  },
];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export async function seedDemo(prisma: PrismaClient) {
  if ((await prisma.user.count()) > 0) return { skipped: true };
  const password = process.env.SEED_DEMO_PASSWORD ?? "demo-entreno-2026";
  const passwordHash = await bcrypt.hash(password, 10);

  const org = await prisma.organization.create({
    data: {
      name: "Centro Demo",
      wellnessThresholds: DEFAULT_WELLNESS_THRESHOLDS,
      blockTypes: { create: DEFAULT_BLOCK_TYPES },
    },
    include: { blockTypes: true },
  });
  const coach = await prisma.user.create({
    data: { orgId: org.id, role: "OWNER", name: "Entrenador Demo", email: "entrenador@demo.test", passwordHash, consentAt: new Date() },
  });
  const athlete = await prisma.user.create({
    data: {
      orgId: org.id,
      role: "ATHLETE",
      name: "Atleta Demo",
      email: "atleta@demo.test",
      passwordHash,
      consentAt: new Date(),
      coachId: coach.id,
      bodyWeightKg: 82,
    },
  });

  const exercises = await prisma.exercise.findMany({ where: { source: "planilla" }, select: { id: true, sourceId: true, loadType: true } });
  const exBySource = new Map(exercises.map((e) => [e.sourceId, e]));
  const blockByKey = new Map(org.blockTypes.map((b) => [b.key, b]));

  // Cuatro semanas: microciclos 4 a 7, donde el 7 es la semana en curso.
  const today = todayISO();
  const start = addDaysISO(mondayOf(today), -21);
  const weeks = [4, 5, 6, 7];
  const kgOffset = (w: number) => (w - 7) * 2.5;

  const program = await prisma.program.create({
    data: {
      orgId: org.id,
      coachId: coach.id,
      athleteId: athlete.id,
      name: "Temporada 2026",
      startDate: fromISODate(start),
      mesocycles: {
        create: {
          order: 0,
          name: "Mesociclo 2: Introductorio",
          goal: "INTRODUCTORY",
          notes: "Pasar paulatinamente de alta intensidad a alto volumen",
          microcycles: {
            create: weeks.map((w, i) => ({
              order: i,
              name: w === 7 ? "Microciclo 7: Introductorio" : `Microciclo ${w}`,
              objective: "Pasar paulatinamente de alta intensidad a alto volumen",
              sessions: {
                create: MICRO_7.map((day, d) => ({
                  order: d,
                  weekday: day.weekday,
                  name: day.name,
                  color: day.color,
                  blocks: {
                    create: day.blocks.map((b, j) => {
                      const bt = blockByKey.get(b.key);
                      return {
                        order: j,
                        blockTypeId: bt?.id,
                        title: bt?.name ?? b.key,
                        items: {
                          create: b.items.map((it, k) => {
                            const ex = exBySource.get(it.ex);
                            if (!ex) throw new Error(`Ejercicio de planilla no encontrado: ${it.ex}`);
                            return {
                              order: k,
                              exerciseId: ex.id,
                              sets: it.sets,
                              repsText: it.reps,
                              ...parseReps(it.reps),
                              loadKg: it.kg != null ? Math.max(0, it.kg + (ex.loadType === "EXTERNAL" ? kgOffset(w) : 0)) : null,
                              rpeTarget: it.rpe ?? null,
                              notes: it.notes ?? null,
                            };
                          }),
                        },
                      };
                    }),
                  },
                })),
              },
            })),
          },
        },
      },
    },
    include: {
      mesocycles: {
        include: {
          microcycles: {
            orderBy: { order: "asc" },
            include: { sessions: { include: { blocks: { include: { items: { include: { exercise: { select: { loadType: true } } } } } } } } },
          },
        },
      },
    },
  });

  // Registros de las sesiones anteriores a hoy.
  const random = rng(7);
  const micros = program.mesocycles[0].microcycles;
  for (const [wi, micro] of micros.entries()) {
    for (const [di, session] of micro.sessions.entries()) {
      const date = addDaysISO(start, wi * 7 + session.weekday);
      if (date >= today) continue;
      const day = MICRO_7[di];
      const workout = await prisma.workoutLog.create({
        data: {
          sessionId: session.id,
          athleteId: athlete.id,
          date: fromISODate(date),
          startedAt: new Date(`${date}T19:00:00Z`),
          completedAt: new Date(`${date}T20:15:00Z`),
          sessionRpe: Math.round((6.5 + random() * 2) * 2) / 2,
          durationMin: 65 + Math.round(random() * 20),
          comment: wi === micros.length - 1 ? (day.comment ?? null) : null,
        },
      });
      const items = session.blocks.flatMap((b) => b.items);
      await prisma.setLog.createMany({
        data: items.flatMap((p) =>
          Array.from({ length: p.sets }, (_, n) => ({
            workoutLogId: workout.id,
            prescriptionId: p.id,
            setNumber: n + 1,
            reps: p.exercise.loadType === "TIME" ? null : (p.repsMax ?? 10),
            seconds: p.exercise.loadType === "TIME" ? (p.repsMax ?? 30) : null,
            loadKg: p.loadKg,
            rpe: p.rpeTarget != null ? Math.min(10, Math.round((p.rpeTarget - 0.5 + random()) * 2) / 2) : null,
            done: true,
          })),
        ),
      });
      const v = () => 1 + Math.floor(random() * 4);
      const values = { sleepTime: v(), sleepQuality: v(), rest: v(), pain: v(), stress: v(), nutrition: v() };
      const total = Object.values(values).reduce((s, x) => s + x, 0);
      await prisma.wellnessCheckin.create({ data: { athleteId: athlete.id, sessionId: session.id, date: fromISODate(date), total, ...values } });
    }
  }

  return { skipped: false, coach: coach.email, athlete: athlete.email };
}
