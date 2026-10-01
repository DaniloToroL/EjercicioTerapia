// Las fechas de calendario (@db.Date) se manejan como "YYYY-MM-DD" en UTC
// para evitar corrimientos por zona horaria.

export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "America/Santiago";

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fromISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function todayISO(timeZone = APP_TIMEZONE): string {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/** Lunes de la semana que contiene la fecha. */
export function mondayOf(iso: string): string {
  const d = fromISODate(iso);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
  return addDaysISO(iso, -dow);
}

export function formatDateLong(iso: string) {
  return new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(fromISODate(iso));
}

const DAYS_COMPACT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_COMPACT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/** "Lun 5 oct": para encabezados de una línea. */
export function formatDateCompact(iso: string) {
  const d = fromISODate(iso);
  return `${DAYS_COMPACT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_COMPACT[d.getUTCMonth()]}`;
}

export function formatDateShort(iso: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" }).format(fromISODate(iso));
}
