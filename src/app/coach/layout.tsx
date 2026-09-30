import { BookOpen, CalendarRange, Settings, ShieldCheck, Smartphone, Users } from "lucide-react";
import { exitOrganization } from "@/actions/admin";
import { CoachShell, type NavItem } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { requireCoach } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CoachLayout({ children }: LayoutProps<"/coach">) {
  const user = await requireCoach();
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.orgId }, select: { name: true } });
  const visiting = user.isSuperadmin && user.orgId !== user.homeOrgId;
  const items: NavItem[] = [
    { href: "/coach", label: "Atletas", icon: <Users className="size-4" />, exact: true },
    { href: "/coach/programas", label: "Programas", icon: <CalendarRange className="size-4" /> },
    { href: "/coach/biblioteca", label: "Biblioteca", icon: <BookOpen className="size-4" /> },
    { href: "/coach/configuracion", label: "Configuración", icon: <Settings className="size-4" /> },
    ...(visiting ? [] : [{ href: "/atleta", label: "Mi entrenamiento", icon: <Smartphone className="size-4" /> }]),
    ...(user.isSuperadmin ? [{ href: "/admin", label: "Superadmin", icon: <ShieldCheck className="size-4" /> }] : []),
  ];
  return (
    <CoachShell items={items} orgName={org.name} userName={user.name}>
      {visiting && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-amber-100 px-4 py-2 text-sm text-amber-950 md:px-8 dark:bg-amber-950/60 dark:text-amber-100">
          <span>
            Estás viendo <strong>{org.name}</strong> como superadmin, con permisos de dueño.
          </span>
          <form action={exitOrganization}>
            <Button type="submit" size="sm" variant="outline">
              Volver a superadmin
            </Button>
          </form>
        </div>
      )}
      {children}
    </CoachShell>
  );
}
