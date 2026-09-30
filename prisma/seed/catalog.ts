// Importa la biblioteca base de ejercicios. Es idempotente: se puede correr en cada despliegue.
// 1) Ejercicios de la planilla original con sus videos (source "planilla", data/planilla-ejercicios.json).
// 2) Catálogo exercises-dataset, solo datos MIT, sin imágenes ni GIF (source "exercises-dataset").

import { readFileSync } from "fs";
import path from "path";
import type { PrismaClient } from "../../src/generated/prisma/client";
import type { LoadType, MovementPattern, VideoProvider } from "../../src/generated/prisma/enums";

type PlanillaExercise = {
  id: string;
  name: string;
  videoUrl: string | null;
  pattern: MovementPattern;
  loadType: LoadType;
  block: string | null;
  equipment: string[];
  unilateral: boolean;
};

// Extraídos de los hipervínculos de la planilla DANILO (pestañas marzo a septiembre):
// un ejercicio por video, con el bloque donde más se usó y el tipo de carga según si se registraron kg.
export const PLANILLA_EXERCISES: PlanillaExercise[] = JSON.parse(
  readFileSync(path.join(__dirname, "..", "data", "planilla-ejercicios.json"), "utf8"),
);

function videoProvider(url: string | null): VideoProvider {
  if (!url) return "NONE";
  return /youtube\.com\/(watch|shorts|embed|live)|youtu\.be\//.test(url) ? "YOUTUBE" : "EXTERNAL";
}

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
  let videosAdded = 0;
  for (const e of PLANILLA_EXERCISES) {
    const video = { videoUrl: e.videoUrl, videoProvider: videoProvider(e.videoUrl) };
    const existing = await prisma.exercise.findUnique({
      where: { source_sourceId: { source: "planilla", sourceId: e.id } },
      select: { id: true, videoProvider: true },
    });
    if (!existing) {
      await prisma.exercise.create({
        data: {
          source: "planilla",
          sourceId: e.id,
          name: e.name,
          pattern: e.pattern,
          loadType: e.loadType,
          defaultBlockKey: e.block,
          equipment: e.equipment,
          unilateral: e.unilateral,
          priority: 1,
          ...video,
        },
      });
      if (e.videoUrl) videosAdded++;
    } else if (existing.videoProvider === "NONE" && e.videoUrl) {
      // Solo se completa el video si falta: lo que el entrenador editó no se pisa.
      await prisma.exercise.update({ where: { id: existing.id }, data: video });
      videosAdded++;
    }
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
  return { planilla: PLANILLA_EXERCISES.length, videos: videosAdded, dataset: toCreate.length };
}
