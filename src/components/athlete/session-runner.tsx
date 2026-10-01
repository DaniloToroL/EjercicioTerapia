"use client";

import { Check, CheckCheck, History, Play, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { finishWorkout, reopenWorkout } from "@/actions/workouts";
import { RestTimer } from "@/components/athlete/rest-timer";
import { WellnessForm } from "@/components/athlete/wellness-form";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { SessionView } from "@/lib/athlete-view";
import { WELLNESS_LEVEL_LABELS, WELLNESS_LEVEL_STYLES, sessionColor } from "@/lib/constants";
import { formatDateCompact, formatDateShort } from "@/lib/dates";
import { formatNumber } from "@/lib/metrics";
import { pendingForSession, saveExerciseRpe, saveSet, subscribePending } from "@/lib/offline-queue";
import { cn } from "@/lib/utils";

type Prescription = SessionView["session"]["blocks"][number]["items"][number];
type LastTime = SessionView["lastByExercise"][string];
type SetState = { reps: string; loadKg: string; seconds: string; done: boolean; queued?: boolean };
/** Lo que indicó el entrenador para cada serie; sirve para mostrar si el atleta hizo más o menos. */
type Baseline = { reps: string; loadKg: string; seconds: string };

const OFFLINE_MSG = "Sin señal: quedó guardado en el teléfono y se enviará al volver la conexión.";
const key = (rxId: string, n: number) => `${rxId}:${n}`;
const str = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));
const num = (v: string) => {
  const t = v.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** Fin del descanso en milisegundos. Fuera del componente porque depende del reloj. */
function restEndsAt(seconds: number) {
  return Date.now() + seconds * 1000;
}

function roundTo(value: number, step = 2.5) {
  return Math.round(value / step) * step;
}

/** Carga indicada por el entrenador; si la dio en % del 1RM se calcula con el mejor 1RM estimado. */
function prescribedKg(p: Prescription, best1RM: number | undefined) {
  if (p.loadKg != null) return p.loadKg;
  if (p.loadPct && best1RM) return roundTo((p.loadPct / 100) * best1RM);
  return null;
}

/** Datos que no están en la tabla (tempo, descanso, % del 1RM). */
function extras(p: Prescription) {
  const parts: string[] = [];
  if (p.loadKg == null && p.loadPct) parts.push(`${p.loadPct}% 1RM`);
  if (p.tempo) parts.push(`tempo ${p.tempo}`);
  if (p.restSec) parts.push(`descanso ${p.restSec >= 60 ? `${Math.floor(p.restSec / 60)}:${String(p.restSec % 60).padStart(2, "0")} min` : `${p.restSec} s`}`);
  return parts.join(", ");
}

function lastText(last: LastTime | undefined, isTime: boolean) {
  if (!last) return null;
  const sets = last.sets
    .slice(0, 6)
    .map((s) => `${isTime ? `${s.seconds ?? 0}s` : (s.reps ?? 0)}${s.loadKg != null ? `x${formatNumber(s.loadKg, 1)}` : ""}`);
  return `${formatDateShort(last.date)}: ${sets.join(", ")}${last.rpe != null ? `, RPE ${formatNumber(last.rpe, 1)}` : ""}`;
}

/** Celda de la tabla: muestra lo indicado y se edita tocándola. Marca la diferencia si se hizo más o menos. */
function ValueCell({
  value,
  baseline,
  onChange,
  onCommit,
  disabled,
  label,
  inputMode = "decimal",
}: {
  value: string;
  baseline: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  disabled: boolean;
  label: string;
  inputMode?: "decimal" | "numeric";
}) {
  const v = num(value);
  const b = num(baseline);
  const delta = v != null && b != null && v !== b ? v - b : null;
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        disabled={disabled}
        inputMode={inputMode}
        placeholder="-"
        aria-label={label}
        className="h-9 w-full rounded-md border border-dashed border-transparent border-b-muted-foreground/40 bg-transparent text-center text-base tabular-nums outline-none focus:border-solid focus:border-ring focus:bg-background disabled:border-b-transparent"
      />
      {delta != null && (
        <span
          className={cn(
            "pointer-events-none absolute -top-0.5 right-0.5 text-[10px] font-semibold tabular-nums",
            delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
          )}
        >
          {delta > 0 ? "+" : "−"}
          {formatNumber(Math.abs(delta), 1)}
        </span>
      )}
    </div>
  );
}

/** Escala 1 a 10 en una sola fila. Tocar el valor elegido lo borra. */
function RpeScale({
  value,
  target,
  onChange,
  disabled,
  large,
}: {
  value: number | null;
  target?: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  large?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 overflow-hidden rounded-md border" role="radiogroup" aria-label="RPE">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`RPE ${n}${target === n ? " (objetivo)" : ""}`}
          disabled={disabled}
          onClick={() => onChange(value === n ? null : n)}
          className={cn(
            "relative flex-1 border-l tabular-nums transition-colors first:border-l-0 disabled:cursor-default",
            large ? "h-11 text-base font-semibold" : "h-8 text-sm",
            value === n ? "bg-primary text-primary-foreground" : "enabled:hover:bg-muted",
          )}
        >
          {n}
          {target === n && value !== n && <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current" />}
        </button>
      ))}
    </div>
  );
}

function ExerciseItem({
  p,
  sets,
  baseline,
  count,
  rpe,
  last,
  disabled,
  onChange,
  onCommit,
  onToggle,
  onMarkAll,
  onAddSet,
  onRpe,
}: {
  p: Prescription;
  sets: Record<string, SetState>;
  baseline: Baseline;
  count: number;
  rpe: number | null;
  last: LastTime | undefined;
  disabled: boolean;
  onChange: (n: number, patch: Partial<SetState>) => void;
  onCommit: (n: number) => void;
  onToggle: (n: number) => void;
  onMarkAll: () => void;
  onAddSet: () => void;
  onRpe: (v: number | null) => void;
}) {
  const [showVideo, setShowVideo] = useState(false);
  const ex = p.exercise;
  const isTime = ex.loadType === "TIME";
  const hasKg = ex.loadType === "EXTERNAL" || (ex.loadType === "BODYWEIGHT" && p.loadKg != null);
  const rows = Array.from({ length: count }, (_, i) => i + 1);
  const done = rows.filter((n) => sets[key(p.id, n)]?.done).length;
  const allDone = done >= count;
  const extra = extras(p);
  const history = lastText(last, isTime);
  const repsLabel = isTime ? "Seg" : ex.loadType === "DISTANCE" ? "Metros" : p.repsText && p.repsMin !== p.repsMax ? `Reps (${p.repsText})` : "Reps";

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="leading-snug font-medium">
            {p.group && <span className="mr-1.5 rounded bg-muted px-1 text-xs font-semibold">{p.group}</span>}
            {ex.name}
          </p>
          {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
        </div>
        {ex.videoProvider !== "NONE" && (
          <Button variant={showVideo ? "secondary" : "ghost"} size="icon-sm" onClick={() => setShowVideo((v) => !v)} aria-label={showVideo ? "Ocultar video" : "Ver video"}>
            <Play />
          </Button>
        )}
        <button
          type="button"
          onClick={onMarkAll}
          disabled={disabled || allDone}
          aria-label={allDone ? "Ejercicio completo" : "Marcar todas las series como hechas"}
          className={cn(
            "flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold tabular-nums transition-colors",
            allDone ? "border-emerald-600 bg-emerald-600 text-white" : "enabled:hover:bg-muted",
          )}
        >
          <CheckCheck className="size-3.5" />
          {done}/{count}
        </button>
      </div>

      {p.notes && <p className="text-xs text-amber-800 dark:text-amber-300">{p.notes}</p>}
      {showVideo && <VideoPlayer provider={ex.videoProvider} url={ex.videoUrl} title={ex.name} autoLoad />}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="w-12 pb-1 text-left font-normal">Serie</th>
            <th className="pb-1 font-normal">{repsLabel}</th>
            {hasKg && <th className="pb-1 font-normal">{ex.loadType === "BODYWEIGHT" ? "Lastre kg" : "Kg"}</th>}
            <th className="w-11 pb-1" />
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => {
            const s = sets[key(p.id, n)];
            if (!s) return null;
            return (
              <tr key={n} className={cn("transition-colors", s.done && "bg-emerald-50 dark:bg-emerald-950/30")}>
                <td className="py-0.5 pl-2 text-muted-foreground tabular-nums">{n}</td>
                <td className="px-1 py-0.5">
                  <ValueCell
                    value={isTime ? s.seconds : s.reps}
                    baseline={isTime ? baseline.seconds : baseline.reps}
                    onChange={(v) => onChange(n, isTime ? { seconds: v } : { reps: v })}
                    onCommit={() => onCommit(n)}
                    disabled={disabled}
                    inputMode="numeric"
                    label={`Serie ${n}, ${isTime ? "segundos" : "repeticiones"}`}
                  />
                </td>
                {hasKg && (
                  <td className="px-1 py-0.5">
                    <ValueCell
                      value={s.loadKg}
                      baseline={baseline.loadKg}
                      onChange={(v) => onChange(n, { loadKg: v })}
                      onCommit={() => onCommit(n)}
                      disabled={disabled}
                      label={`Serie ${n}, kg`}
                    />
                  </td>
                )}
                <td className="py-0.5 pr-1 text-right">
                  <button
                    type="button"
                    onClick={() => onToggle(n)}
                    disabled={disabled}
                    aria-pressed={s.done}
                    aria-label={s.done ? `Serie ${n} hecha` : `Marcar serie ${n} como hecha`}
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-full border transition-colors",
                      s.done ? (s.queued ? "border-amber-500 bg-amber-500 text-white" : "border-emerald-600 bg-emerald-600 text-white") : "enabled:hover:bg-muted",
                    )}
                  >
                    <Check className="size-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* El RPE se pide donde importa: con objetivo del entrenador o con carga externa. */}
      {(p.rpeTarget != null || ex.loadType === "EXTERNAL" || rpe != null) && (
        <div className="flex items-center gap-2">
          <span className="w-9 shrink-0 text-xs leading-tight text-muted-foreground">
            RPE
            {p.rpeTarget != null && <span className="block">obj. {formatNumber(p.rpeTarget, 1)}</span>}
          </span>
          <RpeScale value={rpe} target={p.rpeTarget} onChange={onRpe} disabled={disabled} />
        </div>
      )}

      {(history || !disabled) && (
        <div className="flex items-center justify-between gap-3">
          {!disabled ? (
            <button type="button" onClick={onAddSet} className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Plus className="size-3.5" /> Serie
            </button>
          ) : (
            <span />
          )}
          {history && (
            <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <History className="size-3 shrink-0" />
              <span className="truncate">{history}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function buildInitial(view: SessionView) {
  const state: Record<string, SetState> = {};
  const counts: Record<string, number> = {};
  const baselines: Record<string, Baseline> = {};
  const rpe: Record<string, number | null> = {};
  const logged = new Map((view.workout?.sets ?? []).map((s) => [key(s.prescriptionId, s.setNumber), s]));
  for (const b of view.session.blocks) {
    for (const p of b.items) {
      const maxLogged = Math.max(0, ...(view.workout?.sets ?? []).filter((s) => s.prescriptionId === p.id).map((s) => s.setNumber));
      const count = Math.max(p.sets, maxLogged);
      counts[p.id] = count;
      const isTime = p.exercise.loadType === "TIME";
      const target = str(p.repsMax ?? p.repsMin);
      const base: Baseline = { reps: isTime ? "" : target, seconds: isTime ? target : "", loadKg: str(prescribedKg(p, view.best1RM[p.exercise.id])) };
      baselines[p.id] = base;
      rpe[p.id] = view.workout?.exerciseRpe[p.id] ?? null;
      for (let n = 1; n <= count; n++) {
        const l = logged.get(key(p.id, n));
        state[key(p.id, n)] = l ? { reps: str(l.reps), loadKg: str(l.loadKg), seconds: str(l.seconds), done: l.done } : { ...base, done: false };
      }
    }
  }
  return { state, counts, baselines, rpe };
}

export function SessionRunner({ view }: { view: SessionView }) {
  const router = useRouter();
  const initial = useMemo(() => buildInitial(view), [view]);
  const [sets, setSets] = useState(initial.state);
  const [counts, setCounts] = useState(initial.counts);
  const [rpe, setRpe] = useState(initial.rpe);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setSets(initial.state);
    setCounts(initial.counts);
    setRpe(initial.rpe);
  }
  const [skipCheckin, setSkipCheckin] = useState(false);
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const [sessionRpe, setSessionRpe] = useState<number | null>(view.workout?.sessionRpe ?? null);
  const [finishing, setFinishing] = useState(false);
  const completed = !!view.workout?.completedAt;
  const needsCheckin = !view.checkin && !completed && !skipCheckin;
  const sessionId = view.session.id;

  // Registros que quedaron en la cola offline de este teléfono.
  useEffect(() => {
    const pending = pendingForSession(sessionId);
    if (!pending.sets.length && !pending.rpes.length) return;
    // localStorage solo existe en el navegador: se lee al montar y se superpone al estado del servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSets((prev) => {
      const next = { ...prev };
      for (const s of pending.sets) {
        next[key(s.prescriptionId, s.setNumber)] = { reps: str(s.reps), loadKg: str(s.loadKg), seconds: str(s.seconds), done: s.done, queued: true };
      }
      return next;
    });
    setRpe((prev) => ({ ...prev, ...Object.fromEntries(pending.rpes.map((r) => [r.prescriptionId, r.rpe])) }));
  }, [sessionId]);

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
        sessionId,
        prescriptionId: rxId,
        setNumber: n,
        reps: num(s.reps) != null ? Math.round(num(s.reps)!) : null,
        loadKg: num(s.loadKg),
        seconds: num(s.seconds) != null ? Math.round(num(s.seconds)!) : null,
        done: s.done,
      });
      if (res.error) toast.error(res.error);
      setSets((prev) => ({ ...prev, [key(rxId, n)]: { ...prev[key(rxId, n)], queued: !res.saved && !res.error } }));
      if (!res.saved && !res.error) toast.info(OFFLINE_MSG, { id: "offline" });
    },
    [sessionId],
  );

  function change(rxId: string, n: number, patch: Partial<SetState>) {
    setSets((prev) => ({ ...prev, [key(rxId, n)]: { ...prev[key(rxId, n)], ...patch } }));
  }

  // Al terminar de editar una serie ya marcada como hecha, se guarda el cambio.
  function commit(rxId: string, n: number) {
    const s = sets[key(rxId, n)];
    if (s?.done) persist(rxId, n, s);
  }

  function toggle(p: Prescription, n: number) {
    const current = { ...sets[key(p.id, n)], done: !sets[key(p.id, n)].done };
    setSets((prev) => ({ ...prev, [key(p.id, n)]: current }));
    persist(p.id, n, current);
    if (current.done && p.restSec) setTimerEnd(restEndsAt(p.restSec));
  }

  // Todas las series pendientes del ejercicio, tal como están (lo indicado o lo que se editó).
  function markAll(p: Prescription) {
    const count = counts[p.id] ?? p.sets;
    const updates: [number, SetState][] = [];
    for (let n = 1; n <= count; n++) {
      const s = sets[key(p.id, n)];
      if (s && !s.done) updates.push([n, { ...s, done: true }]);
    }
    if (!updates.length) return;
    setSets((prev) => ({ ...prev, ...Object.fromEntries(updates.map(([n, s]) => [key(p.id, n), s])) }));
    updates.forEach(([n, s]) => persist(p.id, n, s));
    if (p.restSec) setTimerEnd(restEndsAt(p.restSec));
  }

  function addSet(p: Prescription) {
    const n = (counts[p.id] ?? p.sets) + 1;
    const prev = sets[key(p.id, n - 1)] ?? initial.baselines[p.id];
    setCounts((c) => ({ ...c, [p.id]: n }));
    setSets((s) => ({ ...s, [key(p.id, n)]: { reps: prev.reps, loadKg: prev.loadKg, seconds: prev.seconds, done: false } }));
  }

  async function changeRpe(rxId: string, value: number | null) {
    setRpe((prev) => ({ ...prev, [rxId]: value }));
    const res = await saveExerciseRpe({ sessionId, prescriptionId: rxId, rpe: value });
    if (res.error) toast.error(res.error);
    else if (!res.saved) toast.info(OFFLINE_MSG, { id: "offline" });
  }

  const totalSets = Object.values(counts).reduce((s, n) => s + n, 0);
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
      const duration = num(String(f.get("duration") ?? ""));
      const res = await finishWorkout({
        sessionId,
        sessionRpe,
        durationMin: duration ? Math.round(duration) : null,
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
    const res = await reopenWorkout(sessionId);
    if (!res.ok) toast.error(res.error);
    else router.refresh();
  }

  const c = sessionColor(view.session.color);
  const checkin = view.checkin;
  const lowWellness = checkin && (checkin.result.level === "warning" || checkin.result.level === "bad");

  return (
    <div className="space-y-3">
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 -mt-4 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2 text-sm">
          <span className={cn("size-2.5 shrink-0 rounded-full", c.dot)} />
          <span className="max-w-[45%] shrink-0 truncate font-semibold">{view.session.name}</span>
          <span className="min-w-0 truncate text-muted-foreground">
            {view.date ? `${formatDateCompact(view.date)}, ` : ""}
            {view.microcycleName}
          </span>
          {!needsCheckin && (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
              {doneSets}/{totalSets}
            </span>
          )}
        </div>
        {!needsCheckin && <Progress value={totalSets ? (doneSets / totalSets) * 100 : 0} className="mt-2 h-1" />}
      </div>

      {view.session.notes && <p className="text-sm text-muted-foreground">{view.session.notes}</p>}

      {needsCheckin ? (
        <>
          <WellnessForm sessionId={sessionId} thresholds={view.thresholds} onDone={() => router.refresh()} />
          <Button variant="link" className="w-full" onClick={() => setSkipCheckin(true)}>
            Ver la sesión sin hacer el check-in
          </Button>
        </>
      ) : (
        <>
          {checkin && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", WELLNESS_LEVEL_STYLES[checkin.result.level])}>
                  Regeneración {checkin.total}
                </span>
                <span className="truncate text-muted-foreground">{WELLNESS_LEVEL_LABELS[checkin.result.level]}</span>
              </div>
              {lowWellness && <p className="text-xs text-amber-800 dark:text-amber-300">{checkin.result.message}</p>}
            </div>
          )}

          {completed ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm">
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">Sesión completada</p>
                <p className="text-muted-foreground">
                  RPE {view.workout?.sessionRpe != null ? formatNumber(view.workout.sessionRpe, 1) : "-"}, {view.workout?.durationMin ?? "-"} min
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={reopen}>
                Editar registro
              </Button>
            </div>
          ) : (
            doneSets === 0 && (
              <p className="text-xs text-muted-foreground">
                Marca ✓ cada serie que hiciste tal como está. Si hiciste más o menos, toca el número y cámbialo.
              </p>
            )
          )}

          {view.session.blocks
            .filter((b) => b.items.length > 0)
            .map((b) => (
              <section key={b.id} className="space-y-1.5">
                <h2 className={cn("px-1 text-xs font-bold tracking-wide uppercase", c.text)}>{b.title}</h2>
                <div className="divide-y overflow-hidden rounded-xl border bg-card">
                  {b.items.map((p) => (
                    <ExerciseItem
                      key={p.id}
                      p={p}
                      sets={sets}
                      baseline={initial.baselines[p.id]}
                      count={counts[p.id] ?? p.sets}
                      rpe={rpe[p.id] ?? null}
                      last={view.lastByExercise[p.exercise.id]}
                      disabled={completed}
                      onChange={(n, patch) => change(p.id, n, patch)}
                      onCommit={(n) => commit(p.id, n)}
                      onToggle={(n) => toggle(p, n)}
                      onMarkAll={() => markAll(p)}
                      onAddSet={() => addSet(p)}
                      onRpe={(v) => changeRpe(p.id, v)}
                    />
                  ))}
                </div>
              </section>
            ))}

          {!completed && (
            <section className="space-y-3 rounded-xl border bg-card p-3">
              <div>
                <h2 className="font-semibold">Terminar sesión</h2>
                <p className="text-xs text-muted-foreground">RPE de la sesión completa: 1 muy fácil, 10 máximo esfuerzo.</p>
              </div>
              <form onSubmit={finish} className="space-y-3">
                <RpeScale value={sessionRpe} onChange={setSessionRpe} large />
                <div className="flex items-center gap-3">
                  <label htmlFor="duration" className="shrink-0 text-sm">
                    Duración (min)
                  </label>
                  <Input id="duration" name="duration" inputMode="numeric" defaultValue={defaultMinutes ?? ""} placeholder="Automática" />
                </div>
                <Textarea name="comment" rows={2} placeholder="Comentario para tu entrenador (opcional)" defaultValue={view.workout?.comment ?? ""} />
                <Button type="submit" className="h-11 w-full" disabled={finishing}>
                  {finishing ? "Guardando..." : "Terminar y guardar"}
                </Button>
              </form>
            </section>
          )}
        </>
      )}

      {timerEnd && <RestTimer endsAt={timerEnd} onClose={() => setTimerEnd(null)} onAdd={(s) => setTimerEnd((t) => (t ? t + s * 1000 : t))} />}
    </div>
  );
}
