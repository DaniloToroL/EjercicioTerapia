// Importa la biblioteca base de ejercicios. Es idempotente: se puede correr en cada despliegue.
// 1) Ejercicios de la planilla original (source "planilla").
// 2) Catálogo exercises-dataset, solo datos MIT, sin imágenes ni GIF (source "exercises-dataset").

import { readFileSync } from "fs";
import path from "path";
import type { PrismaClient } from "../../src/generated/prisma/client";
import type { LoadType, MovementPattern } from "../../src/generated/prisma/enums";

type PlanillaExercise = {
  id: string;
  name: string;
  pattern: MovementPattern;
  loadType: LoadType;
  block: string;
  equipment?: string[];
  unilateral?: boolean;
};

// Ejercicios tal como aparecen en la planilla "Microciclo 7: Introductorio".
// Los links de video se cargan desde la biblioteca o con el importador de la planilla.
export const PLANILLA_EXERCISES: PlanillaExercise[] = [
  { id: "rock-back-hip-mob", name: "Rock back hip mob (rodilla separada)", pattern: "MOBILITY", loadType: "BODYWEIGHT", block: "construccion" },
  { id: "half-kneeling-tspine-kb", name: "Half kneeling T-spine rotation KB", pattern: "MOBILITY", loadType: "EXTERNAL", block: "construccion", equipment: ["kettlebell"] },
  { id: "tall-kneeling-kb-halo", name: "Tall kneeling KB halo", pattern: "CORE", loadType: "EXTERNAL", block: "construccion", equipment: ["kettlebell"] },
  { id: "half-kneeling-cable-chop", name: "Half kneeling cable chop", pattern: "CORE", loadType: "EXTERNAL", block: "construccion", equipment: ["polea"] },
  { id: "swimming-prone", name: "Swimming prone", pattern: "MOBILITY", loadType: "BODYWEIGHT", block: "construccion" },
  { id: "shoulder-cars-half-kneeling", name: "Shoulder CARs half kneeling", pattern: "MOBILITY", loadType: "BODYWEIGHT", block: "construccion" },
  { id: "single-arm-plank", name: "Single arm plank", pattern: "CORE", loadType: "TIME", block: "construccion", unilateral: true },
  { id: "deep-squat-hamstring-stretch", name: "Deep squat to hamstring stretch", pattern: "MOBILITY", loadType: "BODYWEIGHT", block: "construccion" },
  { id: "kb-windmill-half-kneeling", name: "KB windmill half kneeling", pattern: "CORE", loadType: "EXTERNAL", block: "construccion", equipment: ["kettlebell"], unilateral: true },
  { id: "march-glute", name: "March glute", pattern: "HINGE", loadType: "BODYWEIGHT", block: "construccion" },
  { id: "dns-star-pattern", name: "DNS star pattern", pattern: "CORE", loadType: "BODYWEIGHT", block: "construccion" },
  { id: "wall-slide", name: "Wall slide", pattern: "MOBILITY", loadType: "BODYWEIGHT", block: "construccion" },
  { id: "dorsiflex-kb", name: "Dorsiflex con KB", pattern: "MOBILITY", loadType: "EXTERNAL", block: "construccion", equipment: ["kettlebell"], unilateral: true },
  { id: "bridge-glute-band", name: "Bridge glute with band", pattern: "HINGE", loadType: "BAND", block: "construccion", equipment: ["banda"] },
  { id: "side-plank-hip-lift", name: "Side plank hip lift", pattern: "CORE", loadType: "BODYWEIGHT", block: "construccion", unilateral: true },
  { id: "kick-flow", name: "Kick flow", pattern: "MOBILITY", loadType: "BODYWEIGHT", block: "calentamiento" },
  { id: "wall-drill-load-lift", name: "Wall drill load & lift", pattern: "LOCOMOTION", loadType: "BODYWEIGHT", block: "calentamiento" },
  { id: "pin-squat-quarter", name: "Pin squat 1/4 (grábate) alta velocidad", pattern: "SQUAT", loadType: "EXTERNAL", block: "primario", equipment: ["barra"] },
  { id: "push-up-tempo", name: 'Push up tempo 3" bajada 2" abajo 1 subida', pattern: "HORIZONTAL_PUSH", loadType: "BODYWEIGHT", block: "calentamiento" },
  { id: "shoulder-act-band", name: "Shoulder act band", pattern: "MOBILITY", loadType: "BAND", block: "calentamiento", equipment: ["banda"] },
  { id: "bb-bench-press-pause", name: 'BB bench press (3" de pausa)', pattern: "HORIZONTAL_PUSH", loadType: "EXTERNAL", block: "primario", equipment: ["barra"] },
  { id: "bb-hex-deadlift-pause", name: 'BB hexagonal deadlift (3" pausa)', pattern: "HINGE", loadType: "EXTERNAL", block: "primario", equipment: ["barra hexagonal"] },
  { id: "banded-single-leg-airplane", name: "Banded single leg airplane", pattern: "MOBILITY", loadType: "BAND", block: "calentamiento", equipment: ["banda"], unilateral: true },
  { id: "hanging-scapular-cars", name: "Hanging scapular CARs", pattern: "VERTICAL_PULL", loadType: "BODYWEIGHT", block: "calentamiento", equipment: ["barra fija"] },
  { id: "pull-up-escapular", name: "Pull up escapular", pattern: "VERTICAL_PULL", loadType: "BODYWEIGHT", block: "calentamiento", equipment: ["barra fija"] },
  { id: "pull-up-iso-hold", name: "Pull up ISO hold 90° 90°", pattern: "VERTICAL_PULL", loadType: "TIME", block: "calentamiento", equipment: ["barra fija"] },
  { id: "depth-jump", name: "Depth jump", pattern: "PLYOMETRIC", loadType: "CONTACTS", block: "pliometria", equipment: ["cajón"] },
  { id: "front-monster-walk", name: "Front monster walk", pattern: "LOCOMOTION", loadType: "BAND", block: "pliometria", equipment: ["banda"] },
  { id: "deep-squat-spine-rotation", name: "Deep squat spine rotation", pattern: "MOBILITY", loadType: "BODYWEIGHT", block: "pliometria" },
  { id: "bb-squat-pause", name: 'BB squat 3" pausa', pattern: "SQUAT", loadType: "EXTERNAL", block: "primario", equipment: ["barra"] },
  { id: "cars-escapular", name: "CARs escapular", pattern: "MOBILITY", loadType: "BODYWEIGHT", block: "primario" },
  { id: "pull-up-lastrado", name: 'Pull up lastrado (3" pausa)', pattern: "VERTICAL_PULL", loadType: "BODYWEIGHT", block: "primario", equipment: ["barra fija", "lastre"] },
  { id: "pull-up", name: "Pull up", pattern: "VERTICAL_PULL", loadType: "BODYWEIGHT", block: "primario", equipment: ["barra fija"] },
  { id: "2db-step-up", name: "2 DB step up", pattern: "LUNGE", loadType: "EXTERNAL", block: "secundario", equipment: ["mancuernas", "cajón"], unilateral: true },
  { id: "upright-cable-row", name: "Upright cable row", pattern: "ISOLATION", loadType: "EXTERNAL", block: "secundario", equipment: ["polea"] },
  { id: "bb-overhead-press", name: "BB overhead press", pattern: "VERTICAL_PUSH", loadType: "EXTERNAL", block: "secundario", equipment: ["barra"] },
  { id: "hip-thrust", name: "Hip thrust", pattern: "HINGE", loadType: "EXTERNAL", block: "secundario", equipment: ["barra", "banco"] },
  { id: "bb-rdl", name: "BB RDL", pattern: "HINGE", loadType: "EXTERNAL", block: "secundario", equipment: ["barra"] },
  { id: "scorpion-90", name: "Scorpion 90°", pattern: "MOBILITY", loadType: "BODYWEIGHT", block: "secundario" },
  { id: "2db-seated-arnold-press", name: "2 DB seated Arnold press", pattern: "VERTICAL_PUSH", loadType: "EXTERNAL", block: "secundario", equipment: ["mancuernas", "banco"] },
  { id: "bent-over-row", name: "Bent over row", pattern: "HORIZONTAL_PULL", loadType: "EXTERNAL", block: "secundario", equipment: ["barra"] },
  { id: "elevacion-talones", name: "Elevación de talones", pattern: "ISOLATION", loadType: "EXTERNAL", block: "secundario" },
  { id: "toe-squat", name: "Toe squat", pattern: "SQUAT", loadType: "EXTERNAL", block: "secundario", equipment: ["mancuernas"] },
  { id: "leg-extension", name: "Leg extension", pattern: "ISOLATION", loadType: "EXTERNAL", block: "variabilidad", equipment: ["máquina"] },
  { id: "2db-curl-biceps", name: "2 DB curl bíceps", pattern: "ISOLATION", loadType: "EXTERNAL", block: "variabilidad", equipment: ["mancuernas"] },
  { id: "seated-leg-curl", name: "Seated leg curl", pattern: "ISOLATION", loadType: "EXTERNAL", block: "variabilidad", equipment: ["máquina"] },
];

type DatasetRow = { id: string; name: string; bodyPart: string; equipment: string; target: string; secondary: string[]; es: string; en: string };

const PATTERN_RULES: [RegExp, MovementPattern][] = [
  [/stretch/, "MOBILITY"],
  [/jump|hop\b|bound|plyo/, "PLYOMETRIC"],
  [/carry|farmer/, "CARRY"],
  [/pull-?up|chin-?up|pulldown|pull-down|lat pull/, "VERTICAL_PULL"],
  [/\brow\b|rows\b/, "HORIZONTAL_PULL"],
  [/deadlift|good morning|hip thrust|glute bridge|hyperextension|swing|romanian|\brdl\b/, "HINGE"],
  [/lunge|split squat|step-?up|pistol/, "LUNGE"],
  [/squat/, "SQUAT"],
  [/overhead press|shoulder press|military|arnold|push press|handstand|pike push/, "VERTICAL_PUSH"],
  [/bench press|push-?up|chest press|\bdips?\b|floor press/, "HORIZONTAL_PUSH"],
  [/curl|extension|raise|kickback|shrug|\bfly\b|flye|pec deck|calf|pullover|crossover/, "ISOLATION"],
  [/crunch|sit-?up|plank|twist|leg raise|v-up|rollout|dead bug|side bridge|bicycle|hollow|jackknife|russian/, "CORE"],
];

function datasetPattern(row: DatasetRow): MovementPattern {
  const n = row.name.toLowerCase();
  for (const [re, p] of PATTERN_RULES) if (re.test(n)) return p;
  if (row.bodyPart === "cardio") return "CONDITIONING";
  if (row.bodyPart === "waist") return "CORE";
  return "OTHER";
}

function datasetLoadType(row: DatasetRow, pattern: MovementPattern): LoadType {
  const n = row.name.toLowerCase();
  if (/plank|hold|isometric|stretch|side bridge/.test(n)) return "TIME";
  if (pattern === "PLYOMETRIC") return "CONTACTS";
  if (row.bodyPart === "cardio" && /machine|bike|ergometer|skierg|stepmill|elliptical/.test(row.equipment)) return "TIME";
  if (row.equipment === "body weight" || row.equipment === "assisted") return "BODYWEIGHT";
  if (row.equipment === "band" || row.equipment === "resistance band") return "BAND";
  return "EXTERNAL";
}

function datasetBlock(pattern: MovementPattern, equipment: string): string | null {
  if (pattern === "PLYOMETRIC") return "pliometria";
  if (pattern === "MOBILITY") return "construccion";
  if (pattern === "ISOLATION") return "variabilidad";
  if (["SQUAT", "HINGE", "HORIZONTAL_PUSH", "VERTICAL_PUSH", "VERTICAL_PULL"].includes(pattern) && /barbell/.test(equipment)) return "primario";
  if (["SQUAT", "HINGE", "LUNGE", "HORIZONTAL_PUSH", "VERTICAL_PUSH", "HORIZONTAL_PULL", "VERTICAL_PULL", "CARRY"].includes(pattern)) return "secundario";
  return null;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function importCatalog(prisma: PrismaClient) {
  for (const e of PLANILLA_EXERCISES) {
    const data = {
      name: e.name,
      pattern: e.pattern,
      loadType: e.loadType,
      defaultBlockKey: e.block,
      equipment: e.equipment ?? [],
      unilateral: e.unilateral ?? false,
      priority: 1,
    };
    // Si el entrenador ya editó el ejercicio (video, nombre), no se pisa.
    await prisma.exercise.upsert({
      where: { source_sourceId: { source: "planilla", sourceId: e.id } },
      create: { ...data, source: "planilla", sourceId: e.id },
      update: {},
    });
  }

  const file = path.join(__dirname, "..", "data", "exercises-dataset.json");
  const rows: DatasetRow[] = JSON.parse(readFileSync(file, "utf8"));
  const existing = new Set(
    (await prisma.exercise.findMany({ where: { source: "exercises-dataset" }, select: { sourceId: true } })).map((e) => e.sourceId),
  );
  const toCreate = rows
    .filter((r) => !existing.has(r.id))
    .map((r) => {
      const pattern = datasetPattern(r);
      return {
        source: "exercises-dataset",
        sourceId: r.id,
        priority: 0,
        name: capitalize(r.name),
        nameEn: r.name,
        pattern,
        loadType: datasetLoadType(r, pattern),
        equipment: [r.equipment],
        bodyPart: r.bodyPart,
        targetMuscle: r.target,
        secondaryMuscles: r.secondary,
        instructions: r.es || r.en,
        defaultBlockKey: datasetBlock(pattern, r.equipment),
      };
    });
  if (toCreate.length) await prisma.exercise.createMany({ data: toCreate, skipDuplicates: true });
  return { planilla: PLANILLA_EXERCISES.length, dataset: toCreate.length };
}
