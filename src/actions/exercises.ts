"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/actions/auth";
import { LoadType, MovementPattern, VideoProvider } from "@/generated/prisma/enums";
import { requireCoach } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectVideoProvider } from "@/lib/video";

const exerciseSchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre"),
  nameEn: z.string().trim().max(200).nullable().optional(),
  videoUrl: z.string().trim().max(500).nullable().optional(),
  pattern: z.enum(MovementPattern),
  loadType: z.enum(LoadType),
  equipment: z.array(z.string().trim().min(1)).max(10).default([]),
  instructions: z.string().trim().max(4000).nullable().optional(),
  defaultBlockKey: z.string().trim().nullable().optional(),
  unilateral: z.boolean().default(false),
});

export type ExerciseInput = z.input<typeof exerciseSchema>;

function normalize(data: z.output<typeof exerciseSchema>) {
  const videoUrl = data.videoUrl || null;
  const videoProvider: VideoProvider = videoUrl ? detectVideoProvider(videoUrl) : "NONE";
  return { ...data, videoUrl, videoProvider, nameEn: data.nameEn || null, instructions: data.instructions || null };
}

export async function createExercise(input: ExerciseInput): Promise<ActionResult<{ id: string }>> {
  const coach = await requireCoach();
  const parsed = exerciseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ex = await prisma.exercise.create({ data: { ...normalize(parsed.data), orgId: coach.orgId, source: "custom" } });
  revalidatePath("/coach/biblioteca");
  return { ok: true, data: { id: ex.id } };
}

async function editableExercise(id: string, orgId: string) {
  // Los ejercicios globales (orgId null) también se pueden editar: son la biblioteca base de la instalación.
  return prisma.exercise.findFirst({ where: { id, OR: [{ orgId }, { orgId: null }] } });
}

export async function updateExercise(id: string, input: ExerciseInput): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = exerciseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!(await editableExercise(id, coach.orgId))) return { ok: false, error: "Ejercicio no encontrado" };
  await prisma.exercise.update({ where: { id }, data: normalize(parsed.data) });
  revalidatePath("/coach/biblioteca");
  return { ok: true };
}

export async function setExerciseVideo(id: string, videoUrl: string | null, provider?: VideoProvider): Promise<ActionResult> {
  const coach = await requireCoach();
  if (!(await editableExercise(id, coach.orgId))) return { ok: false, error: "Ejercicio no encontrado" };
  await prisma.exercise.update({
    where: { id },
    data: { videoUrl, videoProvider: videoUrl ? (provider ?? detectVideoProvider(videoUrl)) : "NONE" },
  });
  revalidatePath("/coach/biblioteca");
  return { ok: true };
}

export async function archiveExercise(id: string, archived: boolean): Promise<ActionResult> {
  const coach = await requireCoach();
  if (!(await editableExercise(id, coach.orgId))) return { ok: false, error: "Ejercicio no encontrado" };
  await prisma.exercise.update({ where: { id }, data: { archived } });
  revalidatePath("/coach/biblioteca");
  return { ok: true };
}

export type LibraryExercise = {
  id: string;
  name: string;
  nameEn: string | null;
  pattern: MovementPattern;
  loadType: LoadType;
  equipment: string[];
  videoProvider: VideoProvider;
  videoUrl: string | null;
  source: string;
  defaultBlockKey: string | null;
};

/** Búsqueda para el panel de biblioteca del constructor. */
export async function searchExercises(params: {
  q?: string;
  pattern?: MovementPattern | "ALL";
  source?: "ALL" | "mine" | "dataset";
  withVideo?: boolean;
  take?: number;
}): Promise<LibraryExercise[]> {
  const coach = await requireCoach();
  const q = params.q?.trim();
  const where = {
    archived: false,
    OR: [{ orgId: coach.orgId }, { orgId: null }],
    AND: [
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { nameEn: { contains: q, mode: "insensitive" as const } },
              { equipment: { has: q.toLowerCase() } },
              { targetMuscle: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {},
      params.pattern && params.pattern !== "ALL" ? { pattern: params.pattern } : {},
      params.source === "mine" ? { source: { not: "exercises-dataset" } } : {},
      params.source === "dataset" ? { source: "exercises-dataset" } : {},
      params.withVideo ? { videoProvider: { not: "NONE" as const } } : {},
    ],
  };
  const select = {
    id: true,
    name: true,
    nameEn: true,
    pattern: true,
    loadType: true,
    equipment: true,
    videoProvider: true,
    videoUrl: true,
    source: true,
    defaultBlockKey: true,
  } as const;
  // Primero los propios (planilla y personalizados), después el catálogo base.
  return prisma.exercise.findMany({ where, orderBy: [{ priority: "desc" }, { name: "asc" }], take: params.take ?? 60, select });
}
