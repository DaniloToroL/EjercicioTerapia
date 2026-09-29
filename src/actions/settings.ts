"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/actions/auth";
import { requireCoach } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const thresholdsSchema = z
  .array(
    z.object({
      max: z.number().int().min(6).max(42),
      level: z.enum(["optimal", "good", "warning", "bad"]),
      message: z.string().trim().min(3).max(200),
    }),
  )
  .min(1)
  .max(6);

export async function updateWellnessThresholds(input: z.input<typeof thresholdsSchema>): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = thresholdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa los umbrales: cada tramo necesita un máximo entre 6 y 42 y un mensaje" };
  const sorted = [...parsed.data].sort((a, b) => a.max - b.max);
  sorted[sorted.length - 1].max = 42;
  await prisma.organization.update({ where: { id: coach.orgId }, data: { wellnessThresholds: sorted } });
  revalidatePath("/coach/configuracion");
  return { ok: true };
}

export async function updateOrgName(name: string): Promise<ActionResult> {
  const coach = await requireCoach();
  if (coach.role !== "OWNER") return { ok: false, error: "Solo la cuenta dueña puede cambiar el nombre" };
  if (name.trim().length < 2) return { ok: false, error: "Nombre muy corto" };
  await prisma.organization.update({ where: { id: coach.orgId }, data: { name: name.trim() } });
  revalidatePath("/coach", "layout");
  return { ok: true };
}

export async function addBlockType(name: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const clean = name.trim();
  if (clean.length < 2) return { ok: false, error: "Nombre muy corto" };
  const key = clean
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const exists = await prisma.blockType.findUnique({ where: { orgId_key: { orgId: coach.orgId, key } } });
  if (exists) {
    await prisma.blockType.update({ where: { id: exists.id }, data: { archived: false, name: clean } });
  } else {
    const last = await prisma.blockType.findFirst({ where: { orgId: coach.orgId }, orderBy: { order: "desc" } });
    await prisma.blockType.create({ data: { orgId: coach.orgId, key, name: clean, order: (last?.order ?? 0) + 1 } });
  }
  revalidatePath("/coach/configuracion");
  return { ok: true };
}

export async function updateBlockType(id: string, input: { name?: string; archived?: boolean }): Promise<ActionResult> {
  const coach = await requireCoach();
  const bt = await prisma.blockType.findFirst({ where: { id, orgId: coach.orgId } });
  if (!bt) return { ok: false, error: "Tipo de bloque no encontrado" };
  await prisma.blockType.update({ where: { id }, data: { name: input.name?.trim() || undefined, archived: input.archived } });
  revalidatePath("/coach/configuracion");
  return { ok: true };
}

export async function moveBlockType(id: string, direction: -1 | 1): Promise<ActionResult> {
  const coach = await requireCoach();
  const types = await prisma.blockType.findMany({ where: { orgId: coach.orgId }, orderBy: { order: "asc" }, select: { id: true } });
  const i = types.findIndex((t) => t.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= types.length) return { ok: true };
  [types[i], types[j]] = [types[j], types[i]];
  await prisma.$transaction(types.map((t, k) => prisma.blockType.update({ where: { id: t.id }, data: { order: k + 1 } })));
  revalidatePath("/coach/configuracion");
  return { ok: true };
}
