"use client";

import { logExerciseRpe, logSet, type ExerciseRpeInput, type SetInput } from "@/actions/workouts";

// Cola local de registros pendientes. Si no hay señal en el gimnasio, la serie (o el RPE del ejercicio)
// se guarda en el teléfono y se reenvía al volver la conexión. Las acciones del servidor son idempotentes.

const KEY = "entrenamiento:pending-sets";
type QueueItem = { kind: "set"; input: SetInput } | { kind: "rpe"; input: ExerciseRpeInput };
type Listener = (count: number) => void;
const listeners = new Set<Listener>();

function read(): Record<string, QueueItem> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, QueueItem | SetInput>;
    // Versiones anteriores guardaban la serie sin envoltorio.
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, "kind" in v ? v : { kind: "set", input: v }]));
  } catch {
    return {};
  }
}

function write(q: Record<string, QueueItem>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch {
    // sin almacenamiento disponible: se pierde la cola, pero la UI sigue funcionando
  }
  listeners.forEach((l) => l(Object.keys(q).length));
}

const keyOf = (item: QueueItem) =>
  item.kind === "set"
    ? `${item.input.sessionId}:${item.input.prescriptionId}:${item.input.setNumber}`
    : `${item.input.sessionId}:${item.input.prescriptionId}:rpe`;

function send(item: QueueItem) {
  return item.kind === "set" ? logSet(item.input) : logExerciseRpe(item.input);
}

export function pendingCount() {
  return Object.keys(read()).length;
}

export function subscribePending(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Intenta guardar en el servidor; si falla por red, queda en cola. */
async function save(item: QueueItem): Promise<{ saved: boolean; error?: string }> {
  const key = keyOf(item);
  try {
    const res = await send(item);
    if (!res.ok) return { saved: false, error: res.error };
    const q = read();
    if (q[key]) {
      delete q[key];
      write(q);
    }
    return { saved: true };
  } catch {
    const q = read();
    q[key] = item;
    write(q);
    return { saved: false };
  }
}

export const saveSet = (input: SetInput) => save({ kind: "set", input });
export const saveExerciseRpe = (input: ExerciseRpeInput) => save({ kind: "rpe", input });

let flushing = false;

export async function flushQueue() {
  if (flushing) return;
  flushing = true;
  try {
    for (const [k, item] of Object.entries(read())) {
      try {
        const res = await send(item);
        // Si el servidor rechaza el registro (por ejemplo, el ejercicio ya no existe) se descarta.
        const current = read();
        delete current[k];
        write(current);
        if (!res.ok) console.warn("Registro descartado:", res.error);
      } catch {
        break; // sigue sin conexión
      }
    }
  } finally {
    flushing = false;
  }
}

/** Registros en cola para una sesión, para mostrarlos aunque no hayan llegado al servidor. */
export function pendingForSession(sessionId: string) {
  const items = Object.values(read()).filter((i) => i.input.sessionId === sessionId);
  return {
    sets: items.flatMap((i) => (i.kind === "set" ? [i.input] : [])),
    rpes: items.flatMap((i) => (i.kind === "rpe" ? [i.input] : [])),
  };
}
