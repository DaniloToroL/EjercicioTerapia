import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app-nav";
import { AssignProgramDialog, NewProgramDialog } from "@/components/coach/program-dialogs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAthleteOptions } from "@/lib/athletes";
import { requireCoach } from "@/lib/auth";
import { GOAL_DEFAULTS } from "@/lib/constants";
import { addDaysISO, formatDateShort, todayISO, toISODate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Programas" };

export default async function ProgramsPage() {
  const coach = await requireCoach();
  const [programs, athletes] = await Promise.all([
    prisma.program.findMany({
      where: { orgId: coach.orgId },
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
      include: {
        athlete: { select: { name: true } },
        mesocycles: { orderBy: { order: "asc" }, select: { name: true, goal: true, _count: { select: { microcycles: true } } } },
      },
    }),
    getAthleteOptions(coach.orgId, coach.id),
  ]);
  const assigned = programs.filter((p) => !p.isTemplate);
  const templates = programs.filter((p) => p.isTemplate);
  const today = todayISO();

  function weeks(p: (typeof programs)[number]) {
    return p.mesocycles.reduce((s, m) => s + m._count.microcycles, 0);
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="Programas"
        description="Programas asignados a atletas y plantillas reutilizables."
        actions={<NewProgramDialog athletes={athletes} />}
      />
      <Tabs defaultValue="assigned">
        <TabsList>
          <TabsTrigger value="assigned">Asignados ({assigned.length})</TabsTrigger>
          <TabsTrigger value="templates">Plantillas ({templates.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="assigned">
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Programa</TableHead>
                  <TableHead>Atleta</TableHead>
                  <TableHead className="hidden md:table-cell">Mesociclos</TableHead>
                  <TableHead>Fechas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assigned.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Sin programas asignados.
                    </TableCell>
                  </TableRow>
                )}
                {assigned.map((p) => {
                  const start = p.startDate ? toISODate(p.startDate) : null;
                  const end = start ? addDaysISO(start, weeks(p) * 7 - 1) : null;
                  const current = start && end && start <= today && today <= end;
                  return (
                    <TableRow key={p.id} className={p.active ? "" : "opacity-50"}>
                      <TableCell>
                        <Link href={`/coach/programas/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        {!p.active && <Badge variant="outline" className="ml-2">Archivado</Badge>}
                        {current && p.active && <Badge className="ml-2">En curso</Badge>}
                      </TableCell>
                      <TableCell>{p.athlete?.name ?? "Sin atleta"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {p.mesocycles.map((m, i) => (
                            <Badge key={i} variant="secondary">
                              {GOAL_DEFAULTS[m.goal].label}, {m._count.microcycles} sem
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{start && end ? `${formatDateShort(start)} al ${formatDateShort(end)}` : "Sin fecha"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="templates">
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plantilla</TableHead>
                  <TableHead className="hidden md:table-cell">Mesociclos</TableHead>
                  <TableHead>Semanas</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Sin plantillas. Crea un programa marcado como plantilla o guarda uno existente como plantilla.
                    </TableCell>
                  </TableRow>
                )}
                {templates.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/coach/programas/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {p.mesocycles.map((m, i) => (
                          <Badge key={i} variant="secondary">
                            {GOAL_DEFAULTS[m.goal].label}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{weeks(p)}</TableCell>
                    <TableCell className="text-right">
                      <AssignProgramDialog sourceId={p.id} sourceName={p.name} athletes={athletes} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
