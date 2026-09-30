// Superadmin de la plataforma, definido por variables de entorno (sin pasos manuales):
//   SUPERADMIN_EMAIL      obligatorio para activar este paso
//   SUPERADMIN_PASSWORD   solo se usa si la cuenta no existe (mínimo 8 caracteres)
//   SUPERADMIN_NAME       opcional, nombre de la cuenta nueva
//   SUPERADMIN_ORG        opcional, nombre del centro de la cuenta nueva
// Si la cuenta ya existe (por ejemplo, el dueño que se creó en /setup), solo se marca como superadmin
// y su contraseña no se toca.

import bcrypt from "bcryptjs";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { DEFAULT_BLOCK_TYPES, DEFAULT_WELLNESS_THRESHOLDS } from "../../src/lib/constants";

export async function ensureSuperadmin(prisma: PrismaClient): Promise<string | null> {
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return null;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role === "ATHLETE") return `${email} es una cuenta de atleta; usa otro email para el superadmin.`;
    if (!existing.isSuperadmin) await prisma.user.update({ where: { id: existing.id }, data: { isSuperadmin: true, active: true } });
    return `${email} es superadmin.`;
  }

  const password = process.env.SUPERADMIN_PASSWORD ?? "";
  if (password.length < 8) return `No existe ${email} y SUPERADMIN_PASSWORD falta o tiene menos de 8 caracteres: no se creó el superadmin.`;

  await prisma.organization.create({
    data: {
      name: process.env.SUPERADMIN_ORG?.trim() || "Administración",
      wellnessThresholds: DEFAULT_WELLNESS_THRESHOLDS,
      blockTypes: { create: DEFAULT_BLOCK_TYPES },
      users: {
        create: {
          role: "OWNER",
          isSuperadmin: true,
          name: process.env.SUPERADMIN_NAME?.trim() || "Superadmin",
          email,
          passwordHash: await bcrypt.hash(password, 10),
          consentAt: new Date(),
        },
      },
    },
  });
  return `Superadmin creado: ${email}.`;
}
