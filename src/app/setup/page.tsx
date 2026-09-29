import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthShell } from "@/components/auth-shell";
import { prisma } from "@/lib/prisma";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Configuración inicial" };

export default async function SetupPage() {
  // Se evalúa en cada visita: el estado de la base cambia después del primer arranque.
  await connection();
  const users = await prisma.user.count();
  if (users > 0) redirect("/login");
  return (
    <AuthShell title="Configuración inicial" description="Crea tu centro de entrenamiento y la cuenta principal.">
      <SetupForm />
    </AuthShell>
  );
}
