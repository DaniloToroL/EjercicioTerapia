import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { prisma } from "@/lib/prisma";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Activar cuenta" };

export default async function InvitePage({ params }: PageProps<"/invitacion/[token]">) {
  const { token } = await params;
  const user = await prisma.user.findUnique({
    where: { inviteToken: token },
    select: { name: true, email: true, inviteExpires: true, org: { select: { name: true } } },
  });
  const valid = user && user.inviteExpires && user.inviteExpires > new Date();

  if (!valid) {
    return (
      <AuthShell title="Invitación no válida" description="El link expiró o ya fue usado. Pide uno nuevo a tu entrenador.">
        <span />
      </AuthShell>
    );
  }

  return (
    <AuthShell title={`Hola, ${user.name.split(" ")[0]}`} description={`${user.org.name} te invitó a su plataforma de entrenamiento. Crea una contraseña para ${user.email}.`}>
      <InviteForm token={token} />
    </AuthShell>
  );
}
