import { BookOpen, CalendarRange, Settings, Smartphone, Users } from "lucide-react";
import { CoachShell, type NavItem } from "@/components/app-nav";
import { requireCoach } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CoachLayout({ children }: LayoutProps<"/coach">) {
  const user = await requireCoach();
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.orgId }, select: { name: true } });
  const items: NavItem[] = [
    { href: "/coach", label: "Atletas", icon: <Users className="size-4" />, exact: true },
    { href: "/coach/programas", label: "Programas", icon: <CalendarRange className="size-4" /> },
    { href: "/coach/biblioteca", label: "Biblioteca", icon: <BookOpen className="size-4" /> },
    { href: "/coach/configuracion", label: "Configuración", icon: <Settings className="size-4" /> },
    { href: "/atleta", label: "Mi entrenamiento", icon: <Smartphone className="size-4" /> },
  ];
  return (
    <CoachShell items={items} orgName={org.name} userName={user.name}>
      {children}
    </CoachShell>
  );
}
