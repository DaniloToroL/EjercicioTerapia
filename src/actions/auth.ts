"use server";

import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { DEFAULT_BLOCK_TYPES, DEFAULT_WELLNESS_THRESHOLDS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const setupSchema = z.object({
  orgName: z.string().trim().min(2, "Ingresa el nombre del centro o equipo"),
  name: z.string().trim().min(2, "Ingresa tu nombre"),
  email: z.email("Email inválido").trim().toLowerCase(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

/** Primer arranque: crea la organización y la cuenta dueña. Solo funciona con la base vacía. */
export async function setupOwner(input: z.input<typeof setupSchema>): Promise<ActionResult> {
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const existing = await prisma.user.count();
  if (existing > 0) return { ok: false, error: "La plataforma ya está configurada. Inicia sesión." };

  const { orgName, name, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);
  await prisma.organization.create({
    data: {
      name: orgName,
      wellnessThresholds: DEFAULT_WELLNESS_THRESHOLDS,
      blockTypes: { create: DEFAULT_BLOCK_TYPES },
      users: { create: { role: "OWNER", name, email, passwordHash, consentAt: new Date() } },
    },
  });
  return { ok: true };
}

const inviteSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  consent: z.literal(true, "Debes aceptar el tratamiento de tus datos para continuar"),
});

export async function acceptInvite(input: z.input<typeof inviteSchema>): Promise<ActionResult<{ email: string }>> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const user = await prisma.user.findUnique({ where: { inviteToken: parsed.data.token } });
  if (!user || !user.inviteExpires || user.inviteExpires < new Date()) {
    return { ok: false, error: "La invitación no es válida o expiró. Pide un link nuevo a tu entrenador." };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      inviteToken: null,
      inviteExpires: null,
      consentAt: new Date(),
      active: true,
    },
  });
  return { ok: true, data: { email: user.email } };
}
