"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/actions/auth";

/** Ejecuta una server action mostrando el error en un toast. Devuelve el resultado. */
export function useRunAction() {
  const [pending, startTransition] = useTransition();
  function run<T>(fn: () => Promise<ActionResult<T>>, success?: string): Promise<ActionResult<T>> {
    return new Promise((resolve) => {
      startTransition(async () => {
        try {
          const res = await fn();
          if (!res.ok) toast.error(res.error);
          else if (success) toast.success(success);
          resolve(res);
        } catch {
          toast.error("No se pudo guardar. Revisa tu conexión.");
          resolve({ ok: false, error: "network" });
        }
      });
    });
  }
  return { run, pending };
}
