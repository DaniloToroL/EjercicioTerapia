"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/actions/auth";
import { requireCoach } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const INVITE_DAYS = 14;

function newInvite() {
  return { inviteToken: randomBytes(24).toString("base64url"), inviteExpires: new Date(Date.now() + INVITE_DAYS * 86400000) };
}

const athleteSchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre"),
  email: z.email("Email inválido").trim().toLowerCase(),
  bodyWeightKg: z.number().positive().max(400).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function createAthlete(input: z.input<typeof athleteSchema>): Promise<ActionResult<{ id: string; invitePath: string }>> {
  const coach = await requireCoach();
  const parsed = athleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return { ok: false, error: "Ya existe una cuenta con ese email." };
  const invite = newInvite();
  const user = await prisma.user.create({
    data: { ...parsed.data, role: "ATHLETE", orgId: coach.orgId, coachId: coach.id, ...invite },
  });
  revalidatePath("/coach");
  return { ok: true, data: { id: user.id, invitePath: `/invitacion/${invite.inviteToken}` } };
}

export async function updateAthlete(id: string, input: z.input<typeof athleteSchema>): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = athleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const athlete = await prisma.user.findFirst({ where: { id, orgId: coach.orgId } });
  if (!athlete) return { ok: false, error: "Atleta no encontrado" };
  if (parsed.data.email !== athlete.email) {
    const taken = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (taken) return { ok: false, error: "Ya existe una cuenta con ese email." };
  }
  await prisma.user.update({ where: { id }, data: parsed.data });
  revalidatePath(`/coach/atletas/${id}`);
  return { ok: true };
}

/** Genera un link nuevo para activar la cuenta o restablecer la contraseña. */
export async function regenerateInvite(id: string): Promise<ActionResult<{ invitePath: string }>> {
  const coach = await requireCoach();
  const athlete = await prisma.user.findFirst({ where: { id, orgId: coach.orgId, role: "ATHLETE" } });
  if (!athlete) return { ok: false, error: "Atleta no encontrado" };
  const invite = newInvite();
  await prisma.user.update({ where: { id }, data: invite });
  revalidatePath(`/coach/atletas/${id}`);
  return { ok: true, data: { invitePath: `/invitacion/${invite.inviteToken}` } };
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
