import { LogIn } from "lucide-react";
import type { Metadata } from "next";
import { enterOrganization } from "@/actions/admin";
import { PageHeader } from "@/components/app-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSuperadmin } from "@/lib/auth";
import { addDaysISO, formatDateShort, fromISODate, todayISO, toISODate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { NewOrganizationDialog, OrganizationActions } from "./admin-dialogs";

export const metadata: Metadata = { title: "Superadmin" };

export default async function AdminPage() {
  const admin = await requireSuperadmin();
  const since = fromISODate(addDaysISO(todayISO(), -30));

  const [orgs, users, workouts, exercises] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, active: true, createdAt: true, _count: { select: { programs: true } } },
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, orgId: true, active: true, passwordHash: true } }),
    prisma.workoutLog.findMany({ where: { startedAt: { gte: since } }, select: { athlete: { select: { orgId: true } } } }),
    prisma.exercise.groupBy({ by: ["source"], where: { orgId: null, archived: false }, _count: true }),
  ]);

  const byOrg = new Map<string, typeof users>();
  users.forEach((u) => byOrg.set(u.orgId, [...(byOrg.get(u.orgId) ?? []), u]));
  const sessionsByOrg = new Map<string, number>();
  workouts.forEach((w) => sessionsByOrg.set(w.athlete.orgId, (sessionsByOrg.get(w.athlete.orgId) ?? 0) + 1));

  const totals = {
    orgs: orgs.filter((o) => o.active).length,
    coaches: users.filter((u) => u.role !== "ATHLETE" && u.active).length,
    athletes: users.filter((u) => u.role === "ATHLETE" && u.active).length,
    sessions: workouts.length,
  };
  const globalLibrary = exercises.reduce((s, e) => s + e._count, 0);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="Centros"
        description={`Administración de la plataforma. Biblioteca global: ${globalLibrary} ejercicios, editable solo por superadmin.`}
        actions={<NewOrganizationDialog />}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Centros activos", totals.orgs],
          ["Entrenadores", totals.coaches],
          ["Atletas", totals.athletes],
          ["Sesiones últimos 30 días", totals.sessions],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-3xl font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Centro</TableHead>
              <TableHead>Equipo</TableHead>
              <TableHead className="text-right">Atletas</TableHead>
              <TableHead className="hidden text-right md:table-cell">Programas</TableHead>
              <TableHead className="hidden text-right md:table-cell">Sesiones 30 días</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgs.map((o) => {
              const members = byOrg.get(o.id) ?? [];
              const staff = members.filter((m) => m.role !== "ATHLETE");
              const athletes = members.filter((m) => m.role === "ATHLETE" && m.active).length;
              const isHome = o.id === admin.homeOrgId;
              return (
                <TableRow key={o.id} className={o.active ? "" : "opacity-60"}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      {o.name}
                      {isHome && <Badge variant="secondary">Tu centro</Badge>}
                      {!o.active && <Badge variant="destructive">Suspendido</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">Desde {formatDateShort(toISODate(o.createdAt))}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {staff.map((s) => (
                      <div key={s.id}>
                        {s.name} <span className="text-muted-foreground">({s.role === "OWNER" ? "dueño" : "entrenador"}{!s.passwordHash ? ", sin activar" : ""})</span>
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{athletes}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{o._count.programs}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{sessionsByOrg.get(o.id) ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <form action={enterOrganization.bind(null, o.id)}>
                        <Button type="submit" variant="outline" size="sm">
                          <LogIn /> Entrar
                        </Button>
                      </form>
                      <OrganizationActions org={o} staff={staff.map((s) => ({ id: s.id, name: s.name, role: s.role }))} isHome={isHome} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
