"use client";

import { Check, ChevronDown, History, Plus, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { finishWorkout, reopenWorkout } from "@/actions/workouts";
import { RestTimer } from "@/components/athlete/rest-timer";
import { WellnessForm, WellnessResult } from "@/components/athlete/wellness-form";
import { VideoPlayer } from "@/components/video-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { SessionView } from "@/lib/athlete-view";
import { sessionColor } from "@/lib/constants";
import { formatDateLong, formatDateShort } from "@/lib/dates";
import { formatNumber } from "@/lib/metrics";
import { pendingForSession, saveSet, subscribePending } from "@/lib/offline-queue";
import { cn } from "@/lib/utils";

type Prescription = SessionView["session"]["blocks"][number]["items"][number];
type SetState = { reps: string; loadKg: string; seconds: string; rpe: string; done: boolean; queued?: boolean };

const RPE_OPTIONS = ["5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10"];
const key = (rxId: string, n: number) => `${rxId}:${n}`;
const str = (v: number | null | undefined) => (v == null ? "" : String(v));
const num = (v: string) => {
  const n = Number(v.replace(",", "."));
  return v.trim() && Number.isFinite(n) ? n : null;
};

/** Fin del descanso en milisegundos. Fuera del componente porque depende del reloj. */
function restEndsAt(seconds: number) {
  return Date.now() + seconds * 1000;
}

function roundTo(value: number, step = 2.5) {
  return Math.round(value / step) * step;
}

function suggestedKg(p: Prescription, best1RM: number | undefined, last: SessionView["lastByExercise"][string] | undefined) {
  if (p.loadKg != null) return p.loadKg;
  if (p.loadPct && best1RM) return roundTo((p.loadPct / 100) * best1RM);
  const lastKg = last?.sets.find((s) => s.loadKg != null)?.loadKg;
  return lastKg ?? null;
}

function prescriptionText(p: Prescription, kg: number | null) {
  const isTime = p.exercise.loadType === "TIME";
  const parts = [`${p.sets} x ${p.repsText ?? "-"}${isTime && p.repsText && !/["s]/.test(p.repsText) ? " s" : ""}`];
  if (kg != null) parts.push(`${formatNumber(kg, 1)} kg${p.loadKg == null && p.loadPct ? ` (${p.loadPct}% 1RM)` : ""}`);
  else if (p.loadPct) parts.push(`${p.loadPct}% 1RM`);
  if (p.rpeTarget != null) parts.push(`RPE ${formatNumber(p.rpeTarget, 1)}`);
  if (p.tempo) parts.push(`tempo ${p.tempo}`);
  if (p.restSec) parts.push(`descanso ${p.restSec >= 60 ? `${Math.floor(p.restSec / 60)}:${String(p.restSec % 60).padStart(2, "0")} min` : `${p.restSec} s`}`);
  return parts.join(", ");
}

function lastText(last: SessionView["lastByExercise"][string] | undefined, isTime: boolean) {
  if (!last) return null;
  const sets = [...last.sets]
    .slice(0, 6)
    .map((s) => `${isTime ? `${s.seconds ?? 0}s` : (s.reps ?? 0)}${s.loadKg != null ? `x${formatNumber(s.loadKg, 1)}` : ""}${s.rpe != null ? `@${formatNumber(s.rpe, 1)}` : ""}`);
  return `${formatDateShort(last.date)}: ${sets.join(", ")}`;
}

function ExerciseCard({
  p,
  sets,
  count,
  color,
  view,
  disabled,
  onChange,
  onToggle,
  onAddSet,
}: {
  p: Prescription;
  sets: Record<string, SetState>;
  count: number;
  color: string;
  view: SessionView;
  disabled: boolean;
  onChange: (n: number, patch: Partial<SetState>, commit: boolean) => void;
  onToggle: (n: number) => void;
  onAddSet: () => void;
}) {
  const [showVideo, setShowVideo] = useState(false);
  const ex = p.exercise;
  const isTime = ex.loadType === "TIME";
  const hasKg = ex.loadType === "EXTERNAL" || ex.loadType === "BODYWEIGHT";
  const last = view.lastByExercise[ex.id];
  const kg = suggestedKg(p, view.best1RM[ex.id], last);
  const doneCount = Array.from({ length: count }, (_, i) => sets[key(p.id, i + 1)]?.done).filter(Boolean).length;
  const c = sessionColor(color);

  return (
    <Card className={cn("gap-3 py-4", doneCount >= p.sets && "border-emerald-300 dark:border-emerald-800")}>
      <CardHeader className="px-4">
        <div className="flex items-start gap-2">
          {p.group && <Badge variant="secondary">{p.group}</Badge>}
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-tight">{ex.name}</CardTitle>
            <CardDescription className="mt-1">{prescriptionText(p, kg)}</CardDescription>
          </div>
          <span className={cn("shrink-0 text-sm font-semibold tabular-nums", c.text)}>
            {doneCount}/{p.sets}
          </span>
        </div>
        {p.notes && <p className="rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{p.notes}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {ex.videoProvider !== "NONE" && (
            <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setShowVideo((v) => !v)}>
              <Video /> {showVideo ? "Ocultar video" : "Ver video"}
              <ChevronDown className={cn("transition-transform", showVideo && "rotate-180")} />
            </Button>
          )}
          {last && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <History className="size-3" /> {lastText(last, isTime)}
            </span>
          )}
        </div>
        {showVideo && <VideoPlayer provider={ex.videoProvider} url={ex.videoUrl} title={ex.name} autoLoad />}
      </CardHeader>
      <CardContent className="space-y-1.5 px-4">
        <div className={cn("grid items-center gap-1.5 text-xs text-muted-foreground", hasKg ? "grid-cols-[1.5rem_1fr_1fr_1fr_2.75rem]" : "grid-cols-[1.5rem_1fr_1fr_2.75rem]")}>
          <span>#</span>
          <span>{isTime ? "Segundos" : ex.loadType === "DISTANCE" ? "Metros" : "Reps"}</span>
          {hasKg && <span>{ex.loadType === "BODYWEIGHT" ? "Lastre kg" : "Kg"}</span>}
          <span>RPE</span>
          <span />
        </div>
        {Array.from({ length: count }, (_, i) => i + 1).map((n) => {
          const s = sets[key(p.id, n)];
          if (!s) return null;
          return (
            <div
              key={n}
              className={cn(
                "grid items-center gap-1.5 rounded-md",
                hasKg ? "grid-cols-[1.5rem_1fr_1fr_1fr_2.75rem]" : "grid-cols-[1.5rem_1fr_1fr_2.75rem]",
                s.done && "bg-emerald-50 dark:bg-emerald-950/30",
              )}
            >
              <span className="text-center text-sm font-semibold tabular-nums">{n}</span>
              <Input
                inputMode="numeric"
                value={isTime ? s.seconds : s.reps}
                disabled={disabled}
                onChange={(e) => onChange(n, isTime ? { seconds: e.target.value } : { reps: e.target.value }, false)}
                onBlur={() => onChange(n, {}, true)}
                className="h-10 text-center text-base tabular-nums"
                aria-label={`Serie ${n}, ${isTime ? "segundos" : "repeticiones"}`}
              />
              {hasKg && (
                <Input
                  inputMode="decimal"
                  value={s.loadKg}
                  disabled={disabled}
                  onChange={(e) => onChange(n, { loadKg: e.target.value }, false)}
                  onBlur={() => onChange(n, {}, true)}
                  className="h-10 text-center text-base tabular-nums"
                  aria-label={`Serie ${n}, kg`}
                />
              )}
              <select
                value={s.rpe}
                disabled={disabled}
                onChange={(e) => onChange(n, { rpe: e.target.value }, true)}
                className="h-10 rounded-md border bg-background px-1 text-center text-base tabular-nums"
                aria-label={`Serie ${n}, RPE`}
              >
                <option value="">-</option>
                {RPE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r.replace(".", ",")}
                  </option>
                ))}
              </select>
              <Button
                size="icon-lg"
                variant={s.done ? "default" : "outline"}
                disabled={disabled}
                onClick={() => onToggle(n)}
                className={cn("size-10", s.done && "bg-emerald-600 hover:bg-emerald-700", s.queued && "bg-amber-500")}
                aria-label={s.done ? `Serie ${n} hecha` : `Marcar serie ${n} como hecha`}
                aria-pressed={s.done}
              >
                <Check />
              </Button>
            </div>
          );
        })}
        {!disabled && (
          <Button variant="ghost" size="sm" onClick={onAddSet}>
            <Plus /> Serie extra
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function buildInitial(view: SessionView) {
  const state: Record<string, SetState> = {};
  const counts: Record<string, number> = {};
  const logged = new Map((view.workout?.sets ?? []).map((s) => [key(s.prescriptionId, s.setNumber), s]));
  for (const b of view.session.blocks) {
    for (const p of b.items) {
      const maxLogged = Math.max(0, ...(view.workout?.sets ?? []).filter((s) => s.prescriptionId === p.id).map((s) => s.setNumber));
      const count = Math.max(p.sets, maxLogged);
      counts[p.id] = count;
      const kg = suggestedKg(p, view.best1RM[p.exercise.id], view.lastByExercise[p.exercise.id]);
      const repsDefault = p.exercise.loadType === "TIME" ? "" : str(p.repsMax ?? p.repsMin);
      const secondsDefault = p.exercise.loadType === "TIME" ? str(p.repsMax ?? p.repsMin) : "";
      for (let n = 1; n <= count; n++) {
        const l = logged.get(key(p.id, n));
        state[key(p.id, n)] = l
          ? { reps: str(l.reps), loadKg: str(l.loadKg), seconds: str(l.seconds), rpe: str(l.rpe), done: l.done }
          : { reps: repsDefault, loadKg: str(kg), seconds: secondsDefault, rpe: "", done: false };
      }
    }
  }
  return { state, counts };
}

export function SessionRunner({ view }: { view: SessionView }) {
  const router = useRouter();
  const initial = useMemo(() => buildInitial(view), [view]);
  const [sets, setSets] = useState(initial.state);
  const [counts, setCounts] = useState(initial.counts);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setSets(initial.state);
    setCounts(initial.counts);
  }
  const [skipCheckin, setSkipCheckin] = useState(false);
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const [sessionRpe, setSessionRpe] = useState<number | null>(view.workout?.sessionRpe ?? null);
  const [finishing, setFinishing] = useState(false);
  const completed = !!view.workout?.completedAt;
  const needsCheckin = !view.checkin && !completed && !skipCheckin;
  const rxById = useMemo(() => new Map(view.session.blocks.flatMap((b) => b.items.map((p) => [p.id, p]))), [view]);

  // Series que quedaron en la cola offline de este teléfono.
  useEffect(() => {
    const pending = pendingForSession(view.session.id);
    if (!pending.length) return;
    // localStorage solo existe en el navegador: se lee al montar y se superpone al estado del servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSets((prev) => {
      const next = { ...prev };
      for (const s of pending) {
        next[key(s.prescriptionId, s.setNumber)] = {
          reps: str(s.reps),
          loadKg: str(s.loadKg),
          seconds: str(s.seconds),
          rpe: str(s.rpe),
          done: s.done,
          queued: true,
        };
      }
      return next;
    });
  }, [view.session.id]);

  // Cuando la cola se vacía (volvió la señal), las series dejan de mostrarse como pendientes.
  useEffect(
    () =>
      subscribePending((count) => {
        if (count === 0) setSets((prev) => Object.fromEntries(Object.entries(prev).map(([k, s]) => [k, s.queued ? { ...s, queued: false } : s])));
      }),
    [],
  );

  const persist = useCallback(
    async (rxId: string, n: number, s: SetState) => {
      const res = await saveSet({
        sessionId: view.session.id,
        prescriptionId: rxId,
        setNumber: n,
        reps: num(s.reps) != null ? Math.round(num(s.reps)!) : null,
        loadKg: num(s.loadKg),
        seconds: num(s.seconds) != null ? Math.round(num(s.seconds)!) : null,
        rpe: num(s.rpe),
        done: s.done,
      });
      if (res.error) toast.error(res.error);
      setSets((prev) => ({ ...prev, [key(rxId, n)]: { ...prev[key(rxId, n)], queued: !res.saved && !res.error } }));
      if (!res.saved && !res.error) toast.info("Sin señal: la serie quedó guardada en el teléfono y se enviará al volver la conexión.", { id: "offline" });
    },
    [view.session.id],
  );

  function change(rxId: string, n: number, patch: Partial<SetState>, commit: boolean) {
    const current = { ...sets[key(rxId, n)], ...patch };
    setSets((prev) => ({ ...prev, [key(rxId, n)]: current }));
    // Solo se guarda al confirmar el valor en series ya marcadas como hechas.
    if (commit && current.done) persist(rxId, n, current);
  }

  function toggle(rxId: string, n: number) {
    const current = { ...sets[key(rxId, n)], done: !sets[key(rxId, n)].done };
    setSets((prev) => ({ ...prev, [key(rxId, n)]: current }));
    persist(rxId, n, current);
    const rest = rxById.get(rxId)?.restSec;
    if (current.done && rest) setTimerEnd(restEndsAt(rest));
  }

  function addSet(p: Prescription) {
    const n = (counts[p.id] ?? p.sets) + 1;
    const prev = sets[key(p.id, n - 1)];
    setCounts((c) => ({ ...c, [p.id]: n }));
    setSets((s) => ({ ...s, [key(p.id, n)]: { reps: prev?.reps ?? "", loadKg: prev?.loadKg ?? "", seconds: prev?.seconds ?? "", rpe: "", done: false } }));
  }

  const totalSets = view.session.blocks.reduce((s, b) => s + b.items.reduce((t, p) => t + p.sets, 0), 0);
  const doneSets = Object.values(sets).filter((s) => s.done).length;
  const startedAt = view.workout?.startedAt ? new Date(view.workout.startedAt) : null;
  const [defaultMinutes] = useState(() => (startedAt ? Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 60000)) : null));

  async function finish(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sessionRpe) {
      toast.error("Indica el RPE de la sesión");
      return;
    }
    const f = new FormData(e.currentTarget);
    setFinishing(true);
    try {
      const res = await finishWorkout({
        sessionId: view.session.id,
        sessionRpe,
        durationMin: num(String(f.get("duration") ?? "")) ? Math.round(num(String(f.get("duration")))!) : null,
        comment: String(f.get("comment") ?? "") || null,
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Sesión registrada");
        router.push("/atleta");
      }
    } catch {
      toast.error("Sin conexión. Las series están guardadas; cierra la sesión cuando tengas señal.");
    }
    setFinishing(false);
  }

  async function reopen() {
    const res = await reopenWorkout(view.session.id);
    if (!res.ok) toast.error(res.error);
    else router.refresh();
  }

  const c = sessionColor(view.session.color);

  return (
    <div className="space-y-4">
      <div className={cn("rounded-xl px-4 py-3", c.header)}>
        <h1 className="text-lg font-bold uppercase">{view.session.name}</h1>
        <p className="text-sm opacity-90 first-letter:uppercase">
          {view.date ? formatDateLong(view.date) : ""}
          {view.date ? ", " : ""}
          {view.microcycleName}
        </p>
        {view.objective && <p className="mt-1 text-sm opacity-90">Objetivo: {view.objective}</p>}
      </div>
      {view.session.notes && <p className="rounded-md border bg-card p-3 text-sm">{view.session.notes}</p>}

      {needsCheckin ? (
        <>
          <WellnessForm sessionId={view.session.id} thresholds={view.thresholds} onDone={() => router.refresh()} />
          <Button variant="link" className="w-full" onClick={() => setSkipCheckin(true)}>
            Ver la sesión sin hacer el check-in
          </Button>
        </>
      ) : (
        <>
          {view.checkin && <WellnessResult total={view.checkin.total} result={view.checkin.result} />}

          {completed ? (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                <div className="text-sm">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">Sesión completada</p>
                  <p className="text-muted-foreground">
                    RPE {view.workout?.sessionRpe != null ? formatNumber(view.workout.sessionRpe, 1) : "-"}, {view.workout?.durationMin ?? "-"} min
                  </p>
                </div>
                <Button variant="outline" onClick={reopen}>
                  Editar registro
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 bg-muted/95 px-4 py-2 backdrop-blur">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progreso</span>
                <span className="tabular-nums">
                  {doneSets}/{totalSets} series
                </span>
              </div>
              <Progress value={totalSets ? (doneSets / totalSets) * 100 : 0} className="mt-1" />
            </div>
          )}

          {view.session.blocks
            .filter((b) => b.items.length > 0)
            .map((b) => (
              <section key={b.id} className="space-y-2">
                <h2 className={cn("text-sm font-bold uppercase tracking-wide", c.text)}>{b.title}</h2>
                {b.items.map((p) => (
                  <ExerciseCard
                    key={p.id}
                    p={p}
                    sets={sets}
                    count={counts[p.id] ?? p.sets}
                    color={view.session.color}
                    view={view}
                    disabled={completed}
                    onChange={(n, patch, commit) => change(p.id, n, patch, commit)}
                    onToggle={(n) => toggle(p.id, n)}
                    onAddSet={() => addSet(p)}
                  />
                ))}
              </section>
            ))}

          {!completed && (
            <Card>
              <CardHeader>
                <CardTitle>Terminar sesión</CardTitle>
                <CardDescription>¿Qué tan exigente fue la sesión completa? 1 muy fácil, 10 máximo esfuerzo.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={finish} className="space-y-4">
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSessionRpe(n)}
                        aria-pressed={sessionRpe === n}
                        className={cn(
                          "h-11 rounded-md border text-base font-semibold tabular-nums",
                          sessionRpe === n ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-[1fr_2fr] items-center gap-3">
                    <label htmlFor="duration" className="text-sm">
                      Duración (min)
                    </label>
                    <Input id="duration" name="duration" inputMode="numeric" defaultValue={defaultMinutes ?? ""} placeholder="Automática" />
                  </div>
                  <Textarea name="comment" rows={3} placeholder="Comentarios para tu entrenador (cómo te sentiste, molestias, cargas)" defaultValue={view.workout?.comment ?? ""} />
                  <Button type="submit" className="h-11 w-full" disabled={finishing}>
                    {finishing ? "Guardando..." : "Terminar y guardar"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {timerEnd && (
        <RestTimer endsAt={timerEnd} onClose={() => setTimerEnd(null)} onAdd={(s) => setTimerEnd((t) => (t ? t + s * 1000 : t))} />
      )}
    </div>
  );
}
