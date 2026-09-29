"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/actions/auth";
import { AccessMode } from "@/generated/prisma/enums";
import { requireCoach } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const INVITE_DAYS = 14;

function newAccessToken() {
  return randomBytes(24).toString("base64url");
}

const accessPath = (token: string) => `/r/${token}`;

function newInvite() {
  return { inviteToken: randomBytes(24).toString("base64url"), inviteExpires: new Date(Date.now() + INVITE_DAYS * 86400000) };
}

const athleteSchema = z
  .object({
    name: z.string().trim().min(2, "Ingresa el nombre"),
    // Vacío se guarda como null: un atleta con link abierto no necesita email.
    email: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.email("Email inválido").trim().toLowerCase().nullable()),
    accessMode: z.enum(AccessMode).optional(),
    bodyWeightKg: z.number().positive().max(400).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((d) => d.accessMode !== "LOGIN" || !!d.email, { message: "Para el acceso con login el atleta necesita email", path: ["email"] });

export async function createAthlete(input: z.input<typeof athleteSchema>): Promise<ActionResult<{ id: string; accessPath: string }>> {
  const coach = await requireCoach();
  const parsed = athleteSchema.safeParse({ accessMode: "LOGIN", ...input });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (parsed.data.email && (await prisma.user.findUnique({ where: { email: parsed.data.email } }))) {
    return { ok: false, error: "Ya existe una cuenta con ese email." };
  }
  const accessToken = newAccessToken();
  const user = await prisma.user.create({
    data: { ...parsed.data, role: "ATHLETE", orgId: coach.orgId, coachId: coach.id, accessToken },
  });
  revalidatePath("/coach");
  return { ok: true, data: { id: user.id, accessPath: accessPath(accessToken) } };
}

export async function updateAthlete(id: string, input: z.input<typeof athleteSchema>): Promise<ActionResult> {
  const coach = await requireCoach();
  const athlete = await prisma.user.findFirst({ where: { id, orgId: coach.orgId } });
  if (!athlete) return { ok: false, error: "Atleta no encontrado" };
  // El modo no se edita aquí; se valida contra el actual para exigir email si es con login.
  const parsed = athleteSchema.safeParse({ ...input, accessMode: athlete.role === "ATHLETE" ? athlete.accessMode : "LOGIN" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (parsed.data.email && parsed.data.email !== athlete.email) {
    const taken = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (taken) return { ok: false, error: "Ya existe una cuenta con ese email." };
  }
  const { name, email, bodyWeightKg, notes } = parsed.data;
  await prisma.user.update({ where: { id }, data: { name, email, bodyWeightKg, notes } });
  revalidatePath(`/coach/atletas/${id}`);
  return { ok: true };
}

/** Genera un link para crear o restablecer la contraseña (acceso con login). */
export async function regenerateInvite(id: string): Promise<ActionResult<{ invitePath: string }>> {
  const coach = await requireCoach();
  const athlete = await prisma.user.findFirst({ where: { id, orgId: coach.orgId, role: "ATHLETE" } });
  if (!athlete) return { ok: false, error: "Atleta no encontrado" };
  if (!athlete.email) return { ok: false, error: "El atleta no tiene email: agrégalo para que pueda tener contraseña" };
  const invite = newInvite();
  await prisma.user.update({ where: { id }, data: invite });
  revalidatePath(`/coach/atletas/${id}`);
  return { ok: true, data: { invitePath: `/invitacion/${invite.inviteToken}` } };
}

/** Cambia cómo entra el atleta con su link. Pasar a login invalida las sesiones abiertas por link. */
export async function setAccessMode(id: string, mode: AccessMode): Promise<ActionResult<{ accessPath: string }>> {
  const coach = await requireCoach();
  if (!Object.values(AccessMode).includes(mode)) return { ok: false, error: "Modo inválido" };
  const athlete = await prisma.user.findFirst({ where: { id, orgId: coach.orgId, role: "ATHLETE" } });
  if (!athlete) return { ok: false, error: "Atleta no encontrado" };
  if (mode === "LOGIN" && !athlete.email) return { ok: false, error: "Agrega el email del atleta para usar acceso con login" };
  const accessToken = athlete.accessToken ?? newAccessToken();
  await prisma.user.update({ where: { id }, data: { accessMode: mode, accessToken } });
  revalidatePath("/coach");
  revalidatePath(`/coach/atletas/${id}`);
  return { ok: true, data: { accessPath: accessPath(accessToken) } };
}

/** Reemplaza el link del atleta: el anterior deja de funcionar y se cierran las sesiones abiertas con él. */
export async function regenerateAccessLink(id: string): Promise<ActionResult<{ accessPath: string }>> {
  const coach = await requireCoach();
  const athlete = await prisma.user.findFirst({ where: { id, orgId: coach.orgId, role: "ATHLETE" } });
  if (!athlete) return { ok: false, error: "Atleta no encontrado" };
  const accessToken = newAccessToken();
  await prisma.user.update({ where: { id }, data: { accessToken } });
  revalidatePath("/coach");
  revalidatePath(`/coach/atletas/${id}`);
  return { ok: true, data: { accessPath: accessPath(accessToken) } };
}

export async function setAthleteActive(id: string, active: boolean): Promise<ActionResult> {
  const coach = await requireCoach();
  const athlete = await prisma.user.findFirst({ where: { id, orgId: coach.orgId, role: "ATHLETE" } });
  if (!athlete) return { ok: false, error: "Atleta no encontrado" };
  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath("/coach");
  revalidatePath(`/coach/atletas/${id}`);
  return { ok: true };
}

/** Elimina al atleta y todos sus datos (derecho de supresión). */
export async function deleteAthlete(id: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const athlete = await prisma.user.findFirst({ where: { id, orgId: coach.orgId, role: "ATHLETE" } });
  if (!athlete) return { ok: false, error: "Atleta no encontrado" };
  await prisma.user.delete({ where: { id } });
  revalidatePath("/coach");
  return { ok: true };
}
