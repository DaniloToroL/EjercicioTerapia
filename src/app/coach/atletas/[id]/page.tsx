import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-nav";
import { AssignProgramDialog, NewProgramDialog } from "@/components/coach/program-dialogs";
import { ProgressCharts } from "@/components/progress-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAthleteOptions } from "@/lib/athletes";
import { requireCoach } from "@/lib/auth";
import { WELLNESS_LEVEL_STYLES } from "@/lib/constants";
import { formatDateLong, formatDateShort, toISODate } from "@/lib/dates";
import { evaluateWellness, formatNumber, sessionLoad } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { getProgress, getWellnessThresholds } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { AthleteActions } from "./athlete-actions";

export const metadata: Metadata = { title: "Atleta" };

export default async function AthletePage({ params }: PageProps<"/coach/atletas/[id]">) {
  const coach = await requireCoach();
  const { id } = await params;
  const athlete = await prisma.user.findFirst({
    where: { id, orgId: coach.orgId },
    select: { id: true, name: true, email: true, role: true, active: true, bodyWeightKg: true, notes: true, passwordHash: true, consentAt: true },
  });
  if (!athlete) notFound();

  const [programs, templates, athletes, progress, workouts, thresholds] = await Promise.all([
    prisma.program.findMany({
      where: { athleteId: id, isTemplate: false },
      orderBy: [{ active: "desc" }, { startDate: "desc" }],
      select: { id: true, name: true, active: true, startDate: true, mesocycles: { select: { _count: { select: { microcycles: true } } } } },
    }),
    prisma.program.findMany({ where: { orgId: coach.orgId, isTemplate: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getAthleteOptions(coach.orgId, coach.id),
    getProgress(id, coach.orgId),
    prisma.workoutLog.findMany({
      where: { athleteId: id },
      orderBy: { date: "desc" },
      take: 15,
      include: {
        session: { select: { name: true } },
        sets: {
          orderBy: [{ prescription: { block: { order: "asc" } } }, { prescription: { order: "asc" } }, { setNumber: "asc" }],
          include: {
            prescription: {
              select: { id: true, repsText: true, loadKg: true, rpeTarget: true, sets: true, exercise: { select: { name: true, loadType: true } } },
            },
          },
        },
      },
    }),
    getWellnessThresholds(coach.orgId),
  ]);
  const checkins = await prisma.wellnessCheckin.findMany({ where: { athleteId: id }, select: { sessionId: true, total: true } });
  const checkinBySession = new Map(checkins.map((c) => [c.sessionId, c.total]));
  const isSelf = athlete.id === coach.id;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title={athlete.name}
        description={
          <>
            {athlete.email}
            {athlete.bodyWeightKg ? `, ${formatNumber(athlete.bodyWeightKg, 1)} kg` : ""}
            {!athlete.passwordHash && ", invitación pendiente"}
            {!athlete.active && ", acceso desactivado"}
          </>
        }
        actions={<AthleteActions athlete={athlete} isSelf={isSelf} />}
      />
      {athlete.notes && <p className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-line">{athlete.notes}</p>}

      <Tabs defaultValue="progress">
        <TabsList>
          <TabsTrigger value="progress">Progreso</TabsTrigger>
          <TabsTrigger value="sessions">Sesiones ({workouts.length})</TabsTrigger>
          <TabsTrigger value="programs">Programas ({programs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="pt-2">
          <ProgressCharts data={progress} />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-3 pt-2">
          {workouts.length === 0 && <p className="py-8 text-center text-muted-foreground">Sin sesiones registradas.</p>}
          {workouts.map((w) => {
            const total = checkinBySession.get(w.sessionId);
            const level = total != null ? evaluateWellness(total, thresholds) : null;
            const byRx = new Map<string, typeof w.sets>();
            w.sets.forEach((s) => byRx.set(s.prescription.id, [...(byRx.get(s.prescription.id) ?? []), s]));
            return (
              <Card key={w.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {w.session.name}
                    <span className="font-normal text-muted-foreground">{formatDateLong(toISODate(w.date))}</span>
                    {!w.completedAt && <Badge variant="outline">En curso</Badge>}
                  </CardTitle>
                  <CardDescription className="flex flex-wrap gap-x-4 gap-y-1">
                    {w.sessionRpe != null && <span>RPE sesión {formatNumber(w.sessionRpe, 1)}</span>}
                    {w.durationMin != null && <span>{w.durationMin} min</span>}
                    {sessionLoad(w.sessionRpe, w.durationMin) != null && <span>Carga interna {sessionLoad(w.sessionRpe, w.durationMin)}</span>}
                    {level && total != null && <Badge className={cn(WELLNESS_LEVEL_STYLES[level.level])}>Regeneración {total}</Badge>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {w.comment && <p className="rounded-md bg-muted/50 p-2 text-sm">&quot;{w.comment}&quot;</p>}
                  {byRx.size > 0 && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ejercicio</TableHead>
                            <TableHead>Planificado</TableHead>
                            <TableHead>Realizado (reps x kg, RPE)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...byRx.values()].map((sets) => {
                            const p = sets[0].prescription;
                            const over = sets.some((s) => s.rpe != null && p.rpeTarget != null && s.rpe >= p.rpeTarget + 1.5);
                            return (
                              <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.exercise.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground tabular-nums">
                                  {p.sets} x {p.repsText ?? "-"}
                                  {p.loadKg != null && ` x ${formatNumber(p.loadKg, 1)} kg`}
                                  {p.rpeTarget != null && `, RPE ${formatNumber(p.rpeTarget, 1)}`}
                                </TableCell>
                                <TableCell className={cn("text-sm tabular-nums", over && "text-amber-700 dark:text-amber-400")}>
                                  {sets
                                    .filter((s) => s.done)
                                    .map((s) =>
                                      [
                                        p.exercise.loadType === "TIME" ? `${s.seconds ?? 0}s` : `${s.reps ?? 0}`,
                                        s.loadKg != null ? `x${formatNumber(s.loadKg, 1)}` : "",
                                        s.rpe != null ? ` @${formatNumber(s.rpe, 1)}` : "",
                                      ].join(""),
                                    )
                                    .join(", ") || "Sin series"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="programs" className="space-y-4 pt-2">
          <div className="flex flex-wrap gap-2">
            <NewProgramDialog athletes={athletes} defaultAthleteId={athlete.id} />
            {templates.map((t) => (
              <AssignProgramDialog
                key={t.id}
                sourceId={t.id}
                sourceName={t.name}
                athletes={athletes}
                defaultAthleteId={athlete.id}
                trigger={<Button variant="outline">Asignar plantilla: {t.name}</Button>}
              />
            ))}
          </div>
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Programa</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Semanas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      Sin programas. Crea uno nuevo o asigna una plantilla.
                    </TableCell>
                  </TableRow>
                )}
                {programs.map((p) => (
                  <TableRow key={p.id} className={p.active ? "" : "opacity-50"}>
                    <TableCell>
                      <Link href={`/coach/programas/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      {!p.active && <Badge variant="outline" className="ml-2">Archivado</Badge>}
                    </TableCell>
                    <TableCell>{p.startDate ? formatDateShort(toISODate(p.startDate)) : "Sin fecha"}</TableCell>
                    <TableCell>{p.mesocycles.reduce((s, m) => s + m._count.microcycles, 0)}</TableCell>
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
