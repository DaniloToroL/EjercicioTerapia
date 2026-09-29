import { AlertTriangle, CalendarRange } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app-nav";
import { AthleteFormDialog } from "@/components/coach/athlete-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCoach } from "@/lib/auth";
import { WELLNESS_LEVEL_STYLES } from "@/lib/constants";
import { formatDateShort, todayISO } from "@/lib/dates";
import { getAthletesOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Atletas" };

export default async function CoachHome() {
  const coach = await requireCoach();
  const athletes = await getAthletesOverview(coach.orgId, coach.id);
  const active = athletes.filter((a) => a.active);
  const withAlerts = active.filter((a) => a.alerts.length > 0);
  const today = todayISO();

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader title="Atletas" description="Estado de la semana, regeneración y alertas." actions={<AthleteFormDialog />} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Atletas activos</p>
            <p className="text-3xl font-semibold">{active.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Sesiones esta semana</p>
            <p className="text-3xl font-semibold">
              {active.reduce((s, a) => s + a.doneThisWeek, 0)}
              <span className="text-lg text-muted-foreground"> / {active.reduce((s, a) => s + a.plannedThisWeek, 0)}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Con alertas</p>
            <p className={cn("text-3xl font-semibold", withAlerts.length && "text-amber-600")}>{withAlerts.length}</p>
          </CardContent>
        </Card>
      </div>

      {athletes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-muted-foreground">Todavía no tienes atletas. Crea uno y comparte su link de activación.</p>
            <AthleteFormDialog />
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atleta</TableHead>
                <TableHead>Semana</TableHead>
                <TableHead>Regeneración</TableHead>
                <TableHead className="hidden md:table-cell">Próxima sesión</TableHead>
                <TableHead>Alertas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {athletes.map((a) => (
                <TableRow key={a.id} className={cn(!a.active && "opacity-50")}>
                  <TableCell>
                    <Link href={`/coach/atletas/${a.id}`} className="font-medium hover:underline">
                      {a.name}
                      {a.isSelf && <span className="text-muted-foreground"> (yo)</span>}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {!a.active ? "Inactivo" : a.pendingInvite ? "Invitación pendiente" : a.lastWorkoutDate ? `Última sesión ${formatDateShort(a.lastWorkoutDate)}` : "Sin sesiones"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {a.hasProgram ? (
                      <span className="tabular-nums">
                        {a.doneThisWeek} / {a.plannedThisWeek}
                      </span>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/coach/atletas/${a.id}`}>
                          <CalendarRange className="size-3.5" /> Asignar
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    {a.wellness ? (
                      <Badge className={cn("tabular-nums", WELLNESS_LEVEL_STYLES[a.wellness.level])} title={a.wellness.message}>
                        {a.wellness.total} el {formatDateShort(a.wellness.date)}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin check-in</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {a.nextSession?.date ? (
                      <span className="text-sm">
                        {a.nextSession.date === today ? "Hoy" : formatDateShort(a.nextSession.date)}: {a.nextSession.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Nada programado</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {a.alerts.map((al) => (
                        <Badge key={al} variant="outline" className="gap-1 border-amber-300 text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="size-3" /> {al}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
