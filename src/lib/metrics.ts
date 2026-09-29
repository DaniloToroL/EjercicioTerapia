import type { LoadType } from "@/generated/prisma/enums";
import {
  DEFAULT_WELLNESS_THRESHOLDS,
  type WellnessThreshold,
} from "@/lib/constants";

/**
 * 1RM estimado con Epley ajustado por repeticiones en reserva:
 * kg * (1 + (reps + (10 - RPE)) / 30). Sin RPE se usa Epley simple.
 * Sobre 12 repeticiones la estimación pierde precisión y se descarta.
 */
export function estimate1RM(kg: number | null | undefined, reps: number | null | undefined, rpe?: number | null) {
  if (!kg || !reps || kg <= 0 || reps <= 0 || reps > 12) return null;
  const rir = rpe != null && rpe >= 5 && rpe <= 10 ? 10 - rpe : 0;
  if (reps === 1 && rir === 0) return kg;
  return Math.round(kg * (1 + (reps + rir) / 30) * 10) / 10;
}

export type SetVolume = { tonnage: number; reps: number; seconds: number; contacts: number };

export function emptyVolume(): SetVolume {
  return { tonnage: 0, reps: 0, seconds: 0, contacts: 0 };
}

/** Volumen de una serie según el tipo de carga del ejercicio. */
export function setVolume(loadType: LoadType, s: { reps?: number | null; loadKg?: number | null; seconds?: number | null }): SetVolume {
  const v = emptyVolume();
  const reps = s.reps ?? 0;
  switch (loadType) {
    case "EXTERNAL":
      v.tonnage = reps * (s.loadKg ?? 0);
      v.reps = reps;
      break;
    case "BODYWEIGHT":
      v.reps = reps;
      v.tonnage = reps * (s.loadKg ?? 0); // lastre
      break;
    case "CONTACTS":
      v.contacts = reps;
      break;
    case "TIME":
      v.seconds = s.seconds ?? 0;
      break;
    default:
      v.reps = reps;
  }
  return v;
}

export function addVolume(a: SetVolume, b: SetVolume): SetVolume {
  return {
    tonnage: a.tonnage + b.tonnage,
    reps: a.reps + b.reps,
    seconds: a.seconds + b.seconds,
    contacts: a.contacts + b.contacts,
  };
}

export function formatVolume(v: SetVolume) {
  const parts: string[] = [];
  if (v.tonnage) parts.push(`${formatNumber(v.tonnage)} kg`);
  if (v.reps && !v.tonnage) parts.push(`${v.reps} reps`);
  if (v.contacts) parts.push(`${v.contacts} contactos`);
  if (v.seconds) parts.push(`${v.seconds} s`);
  return parts.length ? parts.join(", ") : "0";
}

export function formatNumber(n: number, digits = 0) {
  return n.toLocaleString("es-CL", { maximumFractionDigits: digits });
}

/** Volumen prescrito de una línea de la rutina (series por reps por kg). */
export function prescribedVolume(
  loadType: LoadType,
  p: { sets: number; repsMin?: number | null; repsMax?: number | null; loadKg?: number | null },
) {
  const reps = p.repsMax ?? p.repsMin ?? 0;
  const one = setVolume(loadType, { reps, loadKg: p.loadKg, seconds: loadType === "TIME" ? reps : 0 });
  return {
    tonnage: one.tonnage * p.sets,
    reps: one.reps * p.sets,
    seconds: one.seconds * p.sets,
    contacts: one.contacts * p.sets,
  };
}

/** Carga interna de la sesión (método de Foster). */
export function sessionLoad(rpe: number | null | undefined, minutes: number | null | undefined) {
  if (!rpe || !minutes) return null;
  return Math.round(rpe * minutes);
}

export function parseThresholds(raw: unknown): WellnessThreshold[] {
  if (Array.isArray(raw) && raw.length && raw.every((t) => typeof t?.max === "number" && typeof t?.message === "string")) {
    return [...(raw as WellnessThreshold[])].sort((a, b) => a.max - b.max);
  }
  return DEFAULT_WELLNESS_THRESHOLDS;
}

export function evaluateWellness(total: number, thresholds: WellnessThreshold[] = DEFAULT_WELLNESS_THRESHOLDS) {
  return thresholds.find((t) => total <= t.max) ?? thresholds[thresholds.length - 1];
}

/** "8 a 10" -> {8,10}; "12" -> {12,12}; "30\" x mano" -> {30,30}. */
export function parseReps(text: string | null | undefined): { repsMin: number | null; repsMax: number | null } {
  if (!text) return { repsMin: null, repsMax: null };
  const t = text.trim().toLowerCase();
  const range = t.match(/^(\d+)\s*(?:a|-|–|al)\s*(\d+)/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return { repsMin: Math.min(a, b), repsMax: Math.max(a, b) };
  }
  const single = t.match(/^(\d+)/);
  if (single) {
    const n = Number(single[1]);
    return { repsMin: n, repsMax: n };
  }
  return { repsMin: null, repsMax: null };
}
