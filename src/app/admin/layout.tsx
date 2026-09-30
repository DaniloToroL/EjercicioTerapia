import { Building2, LayoutDashboard } from "lucide-react";
import { CoachShell, type NavItem } from "@/components/app-nav";
import { requireSuperadmin } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireSuperadmin();
  const items: NavItem[] = [
    { href: "/admin", label: "Centros", icon: <Building2 className="size-4" />, exact: true },
    { href: "/coach", label: "Panel de entrenador", icon: <LayoutDashboard className="size-4" /> },
  ];
  return (
    <CoachShell items={items} orgName="Superadmin" userName={user.name}>
      {children}
    </CoachShell>
  );
}
