"use client";

import { logSet, type SetInput } from "@/actions/workouts";

// Cola local de series pendientes. Si no hay señal en el gimnasio, la serie se guarda
// en el teléfono y se reenvía al volver la conexión. logSet es idempotente.

const KEY = "entrenamiento:pending-sets";
type Listener = (count: number) => void;
const listeners = new Set<Listener>();

function read(): Record<string, SetInput> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

function write(q: Record<string, SetInput>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch {
    // sin almacenamiento disponible: se pierde la cola, pero la UI sigue funcionando
  }
  listeners.forEach((l) => l(Object.keys(q).length));
}

const keyOf = (s: SetInput) => `${s.sessionId}:${s.prescriptionId}:${s.setNumber}`;

export function pendingCount() {
  return Object.keys(read()).length;
}

export function subscribePending(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Intenta guardar en el servidor; si falla por red, queda en cola. Devuelve true si quedó guardada en el servidor. */
export async function saveSet(input: SetInput): Promise<{ saved: boolean; error?: string }> {
  try {
    const res = await logSet(input);
    if (!res.ok) return { saved: false, error: res.error };
    const q = read();
    if (q[keyOf(input)]) {
      delete q[keyOf(input)];
      write(q);
    }
    return { saved: true };
  } catch {
    const q = read();
    q[keyOf(input)] = input;
    write(q);
    return { saved: false };
  }
}

let flushing = false;

export async function flushQueue() {
  if (flushing) return;
  flushing = true;
  try {
    const q = read();
    for (const [k, input] of Object.entries(q)) {
      try {
        const res = await logSet(input);
        // Si el servidor rechaza la serie (por ejemplo, el ejercicio ya no existe) se descarta.
        const current = read();
        delete current[k];
        write(current);
        if (!res.ok) console.warn("Serie descartada:", res.error);
      } catch {
        break; // sigue sin conexión
      }
    }
  } finally {
    flushing = false;
  }
}

/** Series en cola para una sesión, para mostrarlas aunque no hayan llegado al servidor. */
export function pendingForSession(sessionId: string) {
  return Object.values(read()).filter((s) => s.sessionId === sessionId);
}
