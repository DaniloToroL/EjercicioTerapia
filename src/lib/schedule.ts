import { addDaysISO, toISODate } from "@/lib/dates";

type ScheduleProgram = {
  startDate: Date | null;
  mesocycles: {
    order: number;
    microcycles: { id: string; order: number; sessions: { id: string; weekday: number }[] }[];
  }[];
};

/**
 * Calcula la fecha de cada sesión: lunes de inicio + semana global * 7 + día de la semana.
 * La semana global recorre los microciclos de todos los mesociclos en orden.
 */
export function computeSchedule(program: ScheduleProgram) {
  const bySession = new Map<string, { date: string | null; weekIndex: number }>();
  const byMicrocycle = new Map<string, { start: string | null; weekIndex: number }>();
  const start = program.startDate ? toISODate(program.startDate) : null;
  let week = 0;
  const mesos = [...program.mesocycles].sort((a, b) => a.order - b.order);
  for (const meso of mesos) {
    const micros = [...meso.microcycles].sort((a, b) => a.order - b.order);
    for (const micro of micros) {
      byMicrocycle.set(micro.id, { start: start ? addDaysISO(start, week * 7) : null, weekIndex: week });
      for (const s of micro.sessions) {
        bySession.set(s.id, { date: start ? addDaysISO(start, week * 7 + s.weekday) : null, weekIndex: week });
      }
      week++;
    }
  }
  return { bySession, byMicrocycle, totalWeeks: week };
}
