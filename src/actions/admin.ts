"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/actions/auth";
import { ADMIN_ORG_COOKIE, requireSuperadmin } from "@/lib/auth";
import { DEFAULT_BLOCK_TYPES, DEFAULT_WELLNESS_THRESHOLDS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

const INVITE_DAYS = 14;

function newInvite() {
  return { inviteToken: randomBytes(24).toString("base64url"), inviteExpires: new Date(Date.now() + INVITE_DAYS * 86400000) };
}

const personSchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre"),
  email: z.email("Email inválido").trim().toLowerCase(),
});

const orgSchema = personSchema.extend({ orgName: z.string().trim().min(2, "Ingresa el nombre del centro") });

/** Crea un centro con su cuenta dueña y devuelve el link para que el dueño cree su contraseña. */
export async function createOrganization(input: z.input<typeof orgSchema>): Promise<ActionResult<{ invitePath: string }>> {
  await requireSuperadmin();
  const parsed = orgSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { orgName, name, email } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } })) return { ok: false, error: "Ya existe una cuenta con ese email." };
  const invite = newInvite();
  await prisma.organization.create({
    data: {
      name: orgName,
      wellnessThresholds: DEFAULT_WELLNESS_THRESHOLDS,
      blockTypes: { create: DEFAULT_BLOCK_TYPES },
      users: { create: { role: "OWNER", name, email, ...invite } },
    },
  });
  revalidatePath("/admin");
  return { ok: true, data: { invitePath: `/invitacion/${invite.inviteToken}` } };
}

/** Agrega un entrenador a un centro. */
export async function addCoach(orgId: string, input: z.input<typeof personSchema>): Promise<ActionResult<{ invitePath: string }>> {
  await requireSuperadmin();
  const parsed = personSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!(await prisma.organization.findUnique({ where: { id: orgId } }))) return { ok: false, error: "Centro no encontrado" };
  if (await prisma.user.findUnique({ where: { email: parsed.data.email } })) return { ok: false, error: "Ya existe una cuenta con ese email." };
  const invite = newInvite();
  await prisma.user.create({ data: { ...parsed.data, role: "COACH", orgId, ...invite } });
  revalidatePath("/admin");
  return { ok: true, data: { invitePath: `/invitacion/${invite.inviteToken}` } };
}

/** Link nuevo para que un entrenador o dueño cree o cambie su contraseña. */
export async function staffInvite(userId: string): Promise<ActionResult<{ invitePath: string }>> {
  await requireSuperadmin();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role === "ATHLETE" || !user.email) return { ok: false, error: "Cuenta no encontrada" };
  const invite = newInvite();
  await prisma.user.update({ where: { id: userId }, data: invite });
  return { ok: true, data: { invitePath: `/invitacion/${invite.inviteToken}` } };
}

export async function setOrganizationActive(orgId: string, active: boolean): Promise<ActionResult> {
  const admin = await requireSuperadmin();
  if (orgId === admin.homeOrgId && !active) return { ok: false, error: "No puedes suspender tu propio centro" };
  await prisma.organization.update({ where: { id: orgId }, data: { active } });
  revalidatePath("/admin");
  return { ok: true };
}

export async function renameOrganization(orgId: string, name: string): Promise<ActionResult> {
  await requireSuperadmin();
  if (name.trim().length < 2) return { ok: false, error: "Nombre muy corto" };
  await prisma.organization.update({ where: { id: orgId }, data: { name: name.trim() } });
  revalidatePath("/admin");
  return { ok: true };
}

/** Abre el panel de entrenador de otro centro con permisos de dueño. */
export async function enterOrganization(orgId: string) {
  const admin = await requireSuperadmin();
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return;
  const jar = await cookies();
  if (org.id === admin.homeOrgId) jar.delete(ADMIN_ORG_COOKIE);
  else jar.set(ADMIN_ORG_COOKIE, org.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
  redirect("/coach");
}

/** Vuelve a su propio centro. */
export async function exitOrganization() {
  await requireSuperadmin();
  (await cookies()).delete(ADMIN_ORG_COOKIE);
  redirect("/admin");
}
