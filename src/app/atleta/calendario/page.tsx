import type { Metadata } from "next";
import { SessionCard, type SessionStatus } from "@/components/athlete/session-card";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { formatDateShort, addDaysISO, mondayOf, todayISO } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getAthleteSchedule, type ScheduledSession } from "@/lib/queries";

export const metadata: Metadata = { title: "Calendario" };

export default async function AthleteCalendar() {
  const user = await requireUser();
  const [schedule, logs] = await Promise.all([
    getAthleteSchedule(user.id),
    prisma.workoutLog.findMany({ where: { athleteId: user.id }, select: { sessionId: true, completedAt: true } }),
  ]);
  const logBySession = new Map(logs.map((l) => [l.sessionId, l]));
  const today = todayISO();

  const weeks = new Map<string, ScheduledSession[]>();
  for (const s of schedule) {
    const key = s.date ? mondayOf(s.date) : "sin-fecha";
    weeks.set(key, [...(weeks.get(key) ?? []), s]);
  }

  function status(s: ScheduledSession): SessionStatus {
    const log = logBySession.get(s.session.id);
    if (log?.completedAt) return "done";
    if (log) return "in-progress";
    return s.date && s.date < today ? "missed" : "pending";
  }

  if (schedule.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">Sin sesiones programadas.</CardContent>
      </Card>
    );
  }

  const thisWeek = mondayOf(today);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Calendario</h1>
      {[...weeks.entries()].map(([week, sessions]) => {
        const done = sessions.filter((s) => status(s) === "done").length;
        return (
          <section key={week} id={week === thisWeek ? "semana-actual" : undefined} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">
                {sessions[0].microcycleName}
                <span className="font-normal text-muted-foreground">, {sessions[0].mesocycleName}</span>
              </h2>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {week !== "sin-fecha" && `${formatDateShort(week)} al ${formatDateShort(addDaysISO(week, 6))}, `}
                {done}/{sessions.length}
              </span>
            </div>
            {sessions.map((s) => (
              <SessionCard
                key={s.session.id}
                id={s.session.id}
                name={s.session.name}
                color={s.session.color}
                date={s.date}
                status={status(s)}
                exerciseCount={s.session.blocks.reduce((n, b) => n + b.items.length, 0)}
                highlight={s.date === today}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
