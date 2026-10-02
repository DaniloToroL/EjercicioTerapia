import type { Metadata } from "next";
import { SessionCard, type SessionStatus } from "@/components/athlete/session-card";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { addDaysISO, mondayOf, todayISO } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getAthleteSchedule } from "@/lib/queries";

export const metadata: Metadata = { title: "Hoy" };

export default async function AthleteToday() {
  const user = await requireUser();
  const [schedule, logs] = await Promise.all([
    getAthleteSchedule(user.id),
    prisma.workoutLog.findMany({ where: { athleteId: user.id }, select: { sessionId: true, completedAt: true } }),
  ]);
  const logBySession = new Map(logs.map((l) => [l.sessionId, l]));
  const today = todayISO();
  const weekStart = mondayOf(today);
  const weekEnd = addDaysISO(weekStart, 6);

  function status(sessionId: string, date: string | null): SessionStatus {
    const log = logBySession.get(sessionId);
    if (log?.completedAt) return "done";
    if (log) return "in-progress";
    return date && date < today ? "missed" : "pending";
  }

  const todays = schedule.filter((s) => s.date === today);
  const week = schedule.filter((s) => s.date && s.date >= weekStart && s.date <= weekEnd);
  const next = schedule.find((s) => s.date && s.date > today && status(s.session.id, s.date) !== "done");
  const inProgress = schedule.find((s) => status(s.session.id, s.date) === "in-progress" && s.date !== today);
  const count = (s: (typeof schedule)[number]) => s.session.blocks.reduce((n, b) => n + b.items.length, 0);

  if (schedule.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">Todavía no tienes un programa asignado. Tu entrenador te avisará cuando esté listo.</CardContent>
      </Card>
    );
  }

  const current = week[0] ?? todays[0] ?? next;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Hoy</h1>
        {todays.length > 0 ? (
          todays.map((s) => (
            <SessionCard
              key={s.session.id}
              id={s.session.id}
              name={s.session.name}
              color={s.session.color}
              date={s.date}
              status={status(s.session.id, s.date)}
              exerciseCount={count(s)}
              highlight
            />
          ))
        ) : (
          <Card>
            <CardContent className="text-sm text-muted-foreground">Hoy es día de descanso.{next && " Tu próxima sesión:"}</CardContent>
          </Card>
        )}
        {todays.length === 0 && next && (
          <SessionCard id={next.session.id} name={next.session.name} color={next.session.color} date={next.date} status="pending" exerciseCount={count(next)} />
        )}
        {inProgress && (
          <SessionCard
            id={inProgress.session.id}
            name={inProgress.session.name}
            color={inProgress.session.color}
            date={inProgress.date}
            status="in-progress"
            exerciseCount={count(inProgress)}
            subtitle="sin cerrar"
          />
        )}
      </section>

      {week.length > 0 && (
        <section className="space-y-2">
          <div>
            <h2 className="font-semibold">Esta semana</h2>
            {current && (
              <p className="text-sm text-muted-foreground">
                {current.mesocycleName}, {current.microcycleName}
                {current.microcycleObjective ? `. ${current.microcycleObjective}` : ""}
              </p>
            )}
          </div>
          {week.map((s) => (
            <SessionCard
              key={s.session.id}
              id={s.session.id}
              name={s.session.name}
              color={s.session.color}
              date={s.date}
              status={status(s.session.id, s.date)}
              exerciseCount={count(s)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
