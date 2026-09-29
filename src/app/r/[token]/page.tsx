import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "@/app/login/login-form";
import { ActivateForm, OpenAccess } from "./access-forms";

export const metadata: Metadata = { title: "Tu entrenamiento" };

/** Link personal del atleta. El entrenador decide si entra directo (abierto) o con contraseña (login). */
export default async function AccessLinkPage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const athlete = await prisma.user.findUnique({
    where: { accessToken: token },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      accessMode: true,
      passwordHash: true,
      consentAt: true,
      org: { select: { name: true } },
    },
  });

  if (!athlete || !athlete.active || athlete.role !== "ATHLETE") {
    return (
      <AuthShell title="Link no válido" description="El link cambió o ya no está activo. Pide el link actualizado a tu entrenador.">
        <span />
      </AuthShell>
    );
  }

  const current = await getCurrentUser();
  if (current?.id === athlete.id) redirect("/atleta");
  const otherSession = current ? current.name : null;
  const firstName = athlete.name.split(" ")[0];

  if (athlete.accessMode === "OPEN") {
    return (
      <AuthShell title={`Hola, ${firstName}`} description={`${athlete.org.name} te comparte tu plan de entrenamiento.`}>
        <OpenAccess token={token} needsConsent={!athlete.consentAt} otherSession={otherSession} />
      </AuthShell>
    );
  }

  if (!athlete.passwordHash && athlete.email) {
    return (
      <AuthShell title={`Hola, ${firstName}`} description={`${athlete.org.name} te invitó a su plataforma. Crea una contraseña para ${athlete.email}.`}>
        <ActivateForm token={token} otherSession={otherSession} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title={`Hola, ${firstName}`} description="Ingresa con tu contraseña para ver tu entrenamiento.">
      {otherSession && <p className="mb-4 text-sm text-muted-foreground">Ahora estás conectado como {otherSession}. Al ingresar se cerrará esa sesión.</p>}
      <LoginForm defaultEmail={athlete.email ?? undefined} />
    </AuthShell>
  );
}
