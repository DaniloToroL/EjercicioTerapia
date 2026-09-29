import type { LoadType, MesocycleGoal, MovementPattern } from "@/generated/prisma/enums";

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const WEEKDAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export const LOAD_TYPE_LABELS: Record<LoadType, string> = {
  EXTERNAL: "Carga externa (kg)",
  BODYWEIGHT: "Peso corporal",
  BAND: "Banda",
  TIME: "Tiempo (s)",
  DISTANCE: "Distancia (m)",
  CONTACTS: "Contactos (pliometría)",
};

export const PATTERN_LABELS: Record<MovementPattern, string> = {
  SQUAT: "Sentadilla",
  HINGE: "Bisagra de cadera",
  LUNGE: "Zancada / unilateral",
  HORIZONTAL_PUSH: "Empuje horizontal",
  VERTICAL_PUSH: "Empuje vertical",
  HORIZONTAL_PULL: "Tracción horizontal",
  VERTICAL_PULL: "Tracción vertical",
  CORE: "Core",
  CARRY: "Acarreo",
  LOCOMOTION: "Locomoción",
  PLYOMETRIC: "Pliometría",
  MOBILITY: "Movilidad",
  ISOLATION: "Aislamiento",
  CONDITIONING: "Acondicionamiento",
  OTHER: "Otro",
};

export type GoalDefaults = { label: string; sets: number; repsText: string; rpe: number | null; hint: string };

export const GOAL_DEFAULTS: Record<MesocycleGoal, GoalDefaults> = {
  INTRODUCTORY: { label: "Introductorio", sets: 2, repsText: "12", rpe: 6, hint: "Inicio o retorno después de una pausa" },
  HYPERTROPHY: { label: "Hipertrofia", sets: 3, repsText: "8 a 12", rpe: 8, hint: "Acumulación de volumen" },
  STRENGTH: { label: "Fuerza", sets: 4, repsText: "4 a 6", rpe: 8.5, hint: "Intensificación" },
  POWER: { label: "Potencia", sets: 4, repsText: "3", rpe: 7, hint: "Velocidad de ejecución y pliometría" },
  DELOAD: { label: "Descarga", sets: 2, repsText: "8", rpe: 5.5, hint: "Recuperación" },
  REHAB: { label: "Readaptación", sets: 2, repsText: "10", rpe: null, hint: "Pacientes, dolor, control motor" },
  CUSTOM: { label: "Personalizado", sets: 3, repsText: "10", rpe: null, hint: "Sin valores sugeridos" },
};

export const DEFAULT_BLOCK_TYPES = [
  { key: "construccion", name: "Construcción de movimiento", order: 1 },
  { key: "calentamiento", name: "Calentamiento", order: 2 },
  { key: "pliometria", name: "Bloque pliometría", order: 3 },
  { key: "potencia", name: "Bloque potencia", order: 4 },
  { key: "velocidad", name: "Bloque velocidad", order: 5 },
  { key: "primario", name: "Bloque primario", order: 6 },
  { key: "secundario", name: "Bloque secundario", order: 7 },
  { key: "variabilidad", name: "Bloque variabilidad", order: 8 },
];

/** Bloques que se crean por defecto en una sesión nueva. */
export const DEFAULT_SESSION_BLOCKS = ["construccion", "calentamiento", "pliometria", "primario", "secundario", "variabilidad"];

/** Colores de sesión, equivalentes a los encabezados de la planilla. */
export const SESSION_COLORS: Record<string, { label: string; header: string; soft: string; text: string }> = {
  blue: { label: "Azul", header: "bg-blue-800 text-white", soft: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-800 dark:text-blue-300" },
  green: { label: "Verde", header: "bg-green-800 text-white", soft: "bg-green-50 dark:bg-green-950/40", text: "text-green-800 dark:text-green-300" },
  red: { label: "Rojo", header: "bg-red-700 text-white", soft: "bg-red-50 dark:bg-red-950/40", text: "text-red-700 dark:text-red-300" },
  black: { label: "Negro y amarillo", header: "bg-neutral-900 text-amber-400", soft: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400" },
  violet: { label: "Violeta", header: "bg-violet-800 text-white", soft: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-800 dark:text-violet-300" },
  slate: { label: "Gris", header: "bg-slate-700 text-white", soft: "bg-slate-50 dark:bg-slate-900/40", text: "text-slate-700 dark:text-slate-300" },
};
export const SESSION_COLOR_ORDER = ["blue", "green", "red", "black", "violet", "slate"];

export function sessionColor(color: string | null | undefined) {
  return SESSION_COLORS[color ?? "blue"] ?? SESSION_COLORS.blue;
}

export const WELLNESS_ITEMS = [
  { key: "sleepTime", label: "Tiempo de sueño", hint: "1 = dormí lo suficiente, 7 = muy poco" },
  { key: "sleepQuality", label: "Calidad del sueño", hint: "1 = excelente, 7 = muy mala" },
  { key: "rest", label: "Sensación de descanso", hint: "1 = muy descansado, 7 = agotado" },
  { key: "pain", label: "Dolor", hint: "1 = sin dolor, 7 = mucho dolor" },
  { key: "stress", label: "Estrés", hint: "1 = nada, 7 = muy alto" },
  { key: "nutrition", label: "Alimentación", hint: "1 = muy buena, 7 = muy mala" },
] as const;

export type WellnessKey = (typeof WELLNESS_ITEMS)[number]["key"];

export type WellnessLevel = "optimal" | "good" | "warning" | "bad";
export type WellnessThreshold = { max: number; level: WellnessLevel; message: string };

// Pendiente confirmar con los cortes exactos de la fórmula de la planilla.
export const DEFAULT_WELLNESS_THRESHOLDS: WellnessThreshold[] = [
  { max: 10, level: "optimal", message: "Estado óptimo: ejecutar la sesión según lo planificado" },
  { max: 20, level: "good", message: "Buen estado: entrenar con normalidad y monitorizar la respuesta" },
  { max: 28, level: "warning", message: "Estado regular: considerar bajar volumen o intensidad" },
  { max: 42, level: "bad", message: "Estado deficiente: priorizar la recuperación y avisar al entrenador" },
];

export const WELLNESS_LEVEL_STYLES: Record<WellnessLevel, string> = {
  optimal: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  good: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  bad: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
};
