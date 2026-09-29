import "server-only";
import { prisma } from "@/lib/prisma";

/** Atletas que se pueden asignar a un programa: los de la organización más el propio entrenador. */
export async function getAthleteOptions(orgId: string, coachId: string) {
  const users = await prisma.user.findMany({
    where: { orgId, active: true, OR: [{ role: "ATHLETE" }, { id: coachId }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return users.map((u) => ({ ...u, isSelf: u.id === coachId }));
}
