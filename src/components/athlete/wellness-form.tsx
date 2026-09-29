"use client";

import { useState } from "react";
import { saveCheckin } from "@/actions/workouts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WELLNESS_ITEMS, WELLNESS_LEVEL_STYLES, type WellnessKey, type WellnessThreshold } from "@/lib/constants";
import { evaluateWellness } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Values = Record<WellnessKey, number | null>;

export function WellnessResult({ total, result }: { total: number; result: WellnessThreshold }) {
  return (
    <div className={cn("rounded-lg p-3 text-sm", WELLNESS_LEVEL_STYLES[result.level])}>
      <span className="font-semibold">Regeneración {total}/42.</span> {result.message}
    </div>
  );
}

export function WellnessForm({
  sessionId,
  thresholds,
  initial,
  onDone,
}: {
  sessionId: string;
  thresholds: WellnessThreshold[];
  initial?: Partial<Values>;
  onDone: () => void;
}) {
  const [values, setValues] = useState<Values>({
    sleepTime: initial?.sleepTime ?? null,
    sleepQuality: initial?.sleepQuality ?? null,
    rest: initial?.rest ?? null,
    pain: initial?.pain ?? null,
    stress: initial?.stress ?? null,
    nutrition: initial?.nutrition ?? null,
  });
  const [pending, setPending] = useState(false);
  const complete = Object.values(values).every((v) => v != null);
  const total = Object.values(values).reduce<number>((s, v) => s + (v ?? 0), 0);

  async function submit() {
    if (!complete) return;
    setPending(true);
    try {
      const res = await saveCheckin({ sessionId, ...(values as Record<WellnessKey, number>) });
      if (!res.ok) toast.error(res.error);
      else onDone();
    } catch {
      toast.error("Sin conexión. Intenta de nuevo cuando tengas señal.");
    }
    setPending(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>¿Cómo llegas hoy?</CardTitle>
        <CardDescription>Escala de 1 a 7: 1 es muy bien, 7 es muy mal.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {WELLNESS_ITEMS.map((item) => (
          <div key={item.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{item.label}</span>
              <span className="text-xs text-muted-foreground">{item.hint}</span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setValues((v) => ({ ...v, [item.key]: n }))}
                  aria-pressed={values[item.key] === n}
                  className={cn(
                    "h-10 rounded-md border text-sm font-semibold tabular-nums transition-colors",
                    values[item.key] === n
                      ? n <= 2
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : n <= 4
                          ? "border-sky-600 bg-sky-600 text-white"
                          : n <= 5
                            ? "border-amber-500 bg-amber-500 text-white"
                            : "border-red-600 bg-red-600 text-white"
                      : "bg-background hover:bg-muted",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        {complete && <WellnessResult total={total} result={evaluateWellness(total, thresholds)} />}
        <Button className="h-11 w-full" disabled={!complete || pending} onClick={submit}>
          {pending ? "Guardando..." : "Guardar y empezar"}
        </Button>
      </CardContent>
    </Card>
  );
}
