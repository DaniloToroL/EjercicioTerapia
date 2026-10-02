// Carga una semana de la planilla (prisma/data/semana-AAAA-MM-DD.json) como programa de un atleta.
// Las sesiones que ya se hicieron en la planilla quedan registradas (series, RPE, regeneración,
// comentario); las pendientes quedan planificadas, con el RPE de la planilla como objetivo.
//
// Uso (en el servidor, después de desplegar):
//   docker compose run --rm migrate npx tsx prisma/seed/semana.ts --email tu-email-de-la-cuenta
// Opciones:
//   --archivo prisma/data/semana-2026-09-28.json   por defecto, la semana más reciente del repo
//   --reemplazar                                    borra la carga anterior de esa semana y la vuelve a crear

import "dotenv/config";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { fromISODate } from "../../src/lib/dates";
import { parseReps } from "../../src/lib/metrics";

type WeekItem = { exercise: string; label: string; sets: number; reps: string | null; kg: number | null; rpe: number | null; notes: string | null };
type WeekSession = {
  name: string;
  date: string;
  color: string;
  done: boolean;
  checkin: Record<"sleepTime" | "sleepQuality" | "rest" | "pain" | "stress" | "nutrition", number> | null;
  sessionRpe: number | null;
  comment: string | null;
  blocks: { key: string; items: WeekItem[] }[];
};
type Week = { source: string; weekStart: string; mesocycle: string; microcycle: string; sessions: WeekSession[] };

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : (process.argv[i + 1] ?? "");
}

function latestWeekFile() {
  const dir = path.join(__dirname, "..", "data");
  const files = readdirSync(dir)
    .filter((f) => /^semana-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  if (!files.length) throw new Error("No hay archivos semana-*.json en prisma/data");
  return path.join(dir, files[files.length - 1]);
}

const weekday = (iso: string) => (fromISODate(iso).getUTCDay() + 6) % 7; // 0 = lunes

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  if (!email) throw new Error("Falta --email con la cuenta que va a entrenar esta semana");
  const file = arg("archivo") ? path.resolve(arg("archivo")!) : latestWeekFile();
  const replace = process.argv.includes("--reemplazar");
  const week: Week = JSON.parse(readFileSync(file, "utf8"));

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) throw new Error(`No existe una cuenta activa con el email ${email}`);
    const coachId =
      user.role !== "ATHLETE"
        ? user.id
        : (user.coachId ?? (await prisma.user.findFirst({ where: { orgId: user.orgId, role: "OWNER" } }))?.id ?? user.id);

    const marker = `Importado desde la planilla: ${week.source}`;
    const previous = await prisma.program.findFirst({ where: { athleteId: user.id, description: marker } });
    if (previous) {
      if (!replace) {
        console.log(`La semana ya estaba cargada para ${email} ("${previous.name}"). Usa --reemplazar para volver a crearla.`);
        return;
      }
      await prisma.program.delete({ where: { id: previous.id } });
      console.log("Carga anterior eliminada.");
    }

    const blockTypes = new Map((await prisma.blockType.findMany({ where: { orgId: user.orgId } })).map((b) => [b.key, b]));
    const ids = [...new Set(week.sessions.flatMap((s) => s.blocks.flatMap((b) => b.items.map((i) => i.exercise))))];
    const exercises = await prisma.exercise.findMany({ where: { source: "planilla", sourceId: { in: ids } }, select: { id: true, sourceId: true, loadType: true } });
    const exerciseById = new Map(exercises.map((e) => [e.sourceId!, e]));
    const missing = ids.filter((id) => !exerciseById.has(id));
    if (missing.length) throw new Error(`Faltan ejercicios en la biblioteca (corre primero el seed principal): ${missing.join(", ")}`);

    const program = await prisma.program.create({
      data: {
        orgId: user.orgId,
        coachId,
        athleteId: user.id,
        name: `${week.mesocycle} (planilla)`,
        description: marker,
        startDate: fromISODate(week.weekStart),
        mesocycles: {
          create: {
            order: 0,
            name: week.mesocycle,
            goal: "CUSTOM",
            microcycles: {
              create: {
                order: 0,
                name: week.microcycle,
                sessions: {
                  create: week.sessions.map((s, si) => ({
                    order: si,
                    weekday: weekday(s.date),
                    name: s.name,
                    color: s.color,
                    blocks: {
                      create: s.blocks.map((b, bi) => {
                        const type = blockTypes.get(b.key);
                        return {
                          order: bi,
                          blockTypeId: type?.id ?? null,
                          title: type?.name ?? b.key,
                          items: {
                            create: b.items.map((it, ii) => ({
                              order: ii,
                              exerciseId: exerciseById.get(it.exercise)!.id,
                              sets: it.sets,
                              repsText: it.reps,
                              ...parseReps(it.reps),
                              loadKg: it.kg,
                              // En los días pendientes, el RPE de la planilla queda como objetivo.
                              rpeTarget: s.done ? null : it.rpe,
                              notes: it.notes,
                            })),
                          },
                        };
                      }),
                    },
                  })),
                },
              },
            },
          },
        },
      },
      include: {
        mesocycles: {
          include: {
            microcycles: {
              include: {
                sessions: {
                  orderBy: { order: "asc" },
                  include: { blocks: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } } },
                },
              },
            },
          },
        },
      },
    });

    // Sesiones ya hechas en la planilla: registro completo.
    const created = program.mesocycles[0].microcycles[0].sessions;
    let doneCount = 0;
    for (const [si, s] of week.sessions.entries()) {
      if (!s.done) continue;
      const session = created[si];
      const workout = await prisma.workoutLog.create({
        data: {
          sessionId: session.id,
          athleteId: user.id,
          date: fromISODate(s.date),
          startedAt: new Date(`${s.date}T22:00:00Z`),
          completedAt: new Date(`${s.date}T23:15:00Z`),
          sessionRpe: s.sessionRpe,
          comment: s.comment,
        },
      });
      const items = session.blocks.flatMap((b, bi) => b.items.map((p, ii) => ({ p, src: s.blocks[bi].items[ii] })));
      await prisma.setLog.createMany({
        data: items.flatMap(({ p }) => {
          const isTime = exercises.find((e) => e.id === p.exerciseId)?.loadType === "TIME";
          return Array.from({ length: p.sets }, (_, n) => ({
            workoutLogId: workout.id,
            prescriptionId: p.id,
            setNumber: n + 1,
            reps: isTime ? null : p.repsMax,
            seconds: isTime ? p.repsMax : null,
            loadKg: p.loadKg,
            done: true,
          }));
        }),
      });
      const withRpe = items.filter(({ src }) => src.rpe != null);
      if (withRpe.length) {
        await prisma.exerciseLog.createMany({ data: withRpe.map(({ p, src }) => ({ workoutLogId: workout.id, prescriptionId: p.id, rpe: src.rpe })) });
      }
      if (s.checkin) {
        const total = Object.values(s.checkin).reduce((a, b) => a + b, 0);
        await prisma.wellnessCheckin.create({ data: { athleteId: user.id, sessionId: session.id, date: fromISODate(s.date), total, ...s.checkin } });
      }
      doneCount++;
    }

    const pending = week.sessions.filter((s) => !s.done).map((s) => `${s.name} (${s.date})`);
    console.log(`Semana cargada para ${email}: "${program.name}", ${week.microcycle}.`);
    console.log(`${doneCount} sesiones registradas desde la planilla. Pendientes: ${pending.join(", ") || "ninguna"}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
