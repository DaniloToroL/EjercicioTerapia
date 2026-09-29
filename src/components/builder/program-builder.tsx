"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ArrowLeft, CalendarPlus, Copy, MoreVertical, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LibraryExercise } from "@/actions/exercises";
import { addMicrocycle, addPrescription, addSession, deleteMesocycle, deleteMicrocycle, movePrescription, updateMicrocycle } from "@/actions/programs";
import { AddMesocycleDialog, DuplicateWeekDialog, EditMesocycleDialog, ProgramSettingsDialog } from "@/components/builder/dialogs";
import { LibraryDragPreview, LibraryPanel } from "@/components/builder/library-panel";
import { SessionColumn } from "@/components/builder/session-column";
import type { BlockTypeOption, BuilderMesocycle, BuilderProgram, BuilderSession } from "@/components/builder/types";
import { useRunAction } from "@/components/builder/use-action";
import { AssignProgramDialog, type AthleteOption } from "@/components/coach/program-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { GOAL_DEFAULTS, WEEKDAYS } from "@/lib/constants";
import { addDaysISO, formatDateShort } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Schedule = { sessions: Record<string, string | null>; weeks: Record<string, string | null> };

const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length) {
    // Si el puntero está sobre una fila, se prioriza la fila; si no, el bloque.
    const rx = within.find((c) => String(c.id).startsWith("rx:"));
    return rx ? [rx] : within;
  }
  return closestCenter(args);
};

function moveLocal(sessions: BuilderSession[], rxId: string, toBlockId: string, toIndex: number) {
  let moving: BuilderSession["blocks"][number]["items"][number] | undefined;
  const without = sessions.map((s) => ({
    ...s,
    blocks: s.blocks.map((b) => {
      const idx = b.items.findIndex((p) => p.id === rxId);
      if (idx === -1) return b;
      moving = b.items[idx];
      return { ...b, items: b.items.filter((p) => p.id !== rxId) };
    }),
  }));
  if (!moving) return sessions;
  const item = { ...moving, blockId: toBlockId };
  return without.map((s) => ({
    ...s,
    blocks: s.blocks.map((b) => {
      if (b.id !== toBlockId) return b;
      const items = [...b.items];
      items.splice(Math.max(0, Math.min(toIndex, items.length)), 0, item);
      return { ...b, items };
    }),
  }));
}

export function ProgramBuilder({
  program,
  blockTypes,
  athletes,
  schedule,
  initialWeekId,
}: {
  program: BuilderProgram;
  blockTypes: BlockTypeOption[];
  athletes: AthleteOption[];
  schedule: Schedule;
  initialWeekId?: string;
}) {
  const router = useRouter();
  const { run } = useRunAction();
  const allWeeks = program.mesocycles.flatMap((m) => m.microcycles.map((w) => ({ week: w, meso: m })));
  const [weekId, setWeekIdState] = useState(initialWeekId && allWeeks.some((w) => w.week.id === initialWeekId) ? initialWeekId : allWeeks[0]?.week.id);
  // Se usa el objeto original de las props: su identidad cambia solo cuando el servidor envía datos nuevos.
  const current = (allWeeks.find((w) => w.week.id === weekId) ?? allWeeks[0])?.week;

  // Copia local de la semana para mover ejercicios sin esperar al servidor.
  const [prevWeek, setPrevWeek] = useState(current);
  const [sessions, setSessions] = useState<BuilderSession[]>(current?.sessions ?? []);
  if (current !== prevWeek) {
    setPrevWeek(current);
    setSessions(current?.sessions ?? []);
  }

  const [dragging, setDragging] = useState<{ type: "lib"; exercise: LibraryExercise } | { type: "rx"; name: string } | null>(null);
  const [dupOpen, setDupOpen] = useState(false);
  const [mesoOpen, setMesoOpen] = useState(false);
  const [editMeso, setEditMeso] = useState<BuilderMesocycle | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function selectWeek(id: string) {
    setWeekIdState(id);
    router.replace(`?semana=${id}`, { scroll: false });
  }

  function findTarget(overId: string, overData: Record<string, unknown> | undefined) {
    if (overId.startsWith("block:")) {
      const blockId = overId.slice(6);
      const block = sessions.flatMap((s) => s.blocks).find((b) => b.id === blockId);
      return block ? { blockId, index: block.items.length } : null;
    }
    if (overId.startsWith("rx:")) {
      const blockId = overData?.blockId as string;
      const block = sessions.flatMap((s) => s.blocks).find((b) => b.id === blockId);
      if (!block) return null;
      return { blockId, index: block.items.findIndex((p) => p.id === overId.slice(3)) };
    }
    return null;
  }

  function onDragStart(e: DragStartEvent) {
    const data = e.active.data.current as { type: string; exercise?: LibraryExercise } | undefined;
    if (data?.type === "lib" && data.exercise) setDragging({ type: "lib", exercise: data.exercise });
    else {
      const id = String(e.active.id).slice(3);
      const rx = sessions.flatMap((s) => s.blocks.flatMap((b) => b.items)).find((p) => p.id === id);
      setDragging({ type: "rx", name: rx?.exercise.name ?? "" });
    }
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    if (!e.over) return;
    const target = findTarget(String(e.over.id), e.over.data.current as Record<string, unknown> | undefined);
    if (!target) return;
    const activeId = String(e.active.id);
    if (activeId.startsWith("lib:")) {
      run(() => addPrescription(target.blockId, activeId.slice(4), target.index));
      return;
    }
    const rxId = activeId.slice(3);
    const fromBlock = e.active.data.current?.blockId as string;
    const fromIndex = sessions.flatMap((s) => s.blocks).find((b) => b.id === fromBlock)?.items.findIndex((p) => p.id === rxId) ?? -1;
    if (fromBlock === target.blockId && fromIndex === target.index) return;
    setSessions((prev) => moveLocal(prev, rxId, target.blockId, target.index));
    run(() => movePrescription(rxId, target.blockId, target.index));
  }

  const weekDate = current ? schedule.weeks[current.id] : null;
  const usedDays = new Set(sessions.map((s) => s.weekday));
  const weekOptions = allWeeks.map((w) => ({ id: w.week.id, label: `${w.meso.name}: ${w.week.name}` }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-4 border-b p-4 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Volver">
            <Link href="/coach/programas">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold">{program.name}</h1>
            <p className="text-sm text-muted-foreground">
              {program.isTemplate ? "Plantilla" : program.athlete ? `Asignado a ${program.athlete.name}` : "Sin atleta"}
              {!program.active && ", archivado"}
            </p>
          </div>
          {program.isTemplate && (
            <AssignProgramDialog
              sourceId={program.id}
              sourceName={program.name}
              athletes={athletes}
              trigger={
                <Button>
                  <CalendarPlus /> Asignar a atleta
                </Button>
              }
            />
          )}
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings2 /> Configurar
          </Button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          {program.mesocycles.map((meso) => (
            <div key={meso.id} className="shrink-0 rounded-lg border p-2">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold">{meso.name}</span>
                <Badge variant="secondary">{GOAL_DEFAULTS[meso.goal].label}</Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-xs" aria-label="Opciones del mesociclo">
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => setEditMeso(meso)}>
                      <Pencil /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={async () => {
                        const res = await run(() => addMicrocycle(meso.id));
                        if (res.ok && res.data) selectWeek(res.data.id);
                      }}
                    >
                      <Plus /> Agregar semana vacía
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => run(() => deleteMesocycle(meso.id))}>
                      <Trash2 /> Eliminar mesociclo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex gap-1">
                {meso.microcycles.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => selectWeek(w.id)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs whitespace-nowrap transition-colors",
                      w.id === current?.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {w.name}
                    {schedule.weeks[w.id] && <span className="block text-[10px] opacity-70">{formatDateShort(schedule.weeks[w.id]!)}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Button variant="outline" className="h-auto shrink-0 self-stretch border-dashed" onClick={() => setMesoOpen(true)}>
            <Plus /> Mesociclo
          </Button>
        </div>
      </div>

      {current && (
        <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1 space-y-3 p-4 md:px-6">
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid min-w-48 flex-1 gap-1 sm:max-w-xs">
                  <label className="text-xs text-muted-foreground">Semana</label>
                  <Input
                    key={`name-${current.id}-${current.name}`}
                    defaultValue={current.name}
                    className="font-semibold"
                    onBlur={(e) => {
                      const v = e.currentTarget.value.trim();
                      if (v && v !== current.name) run(() => updateMicrocycle(current.id, { name: v }));
                    }}
                  />
                </div>
                <div className="grid min-w-64 flex-[2] gap-1">
                  <label className="text-xs text-muted-foreground">Objetivo de la semana</label>
                  <Input
                    key={`obj-${current.id}-${current.objective}`}
                    defaultValue={current.objective ?? ""}
                    placeholder="Ej: pasar paulatinamente de alta intensidad a alto volumen"
                    onBlur={(e) => {
                      const v = e.currentTarget.value.trim();
                      if (v !== (current.objective ?? "")) run(() => updateMicrocycle(current.id, { objective: v || null }));
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {weekDate && (
                    <span className="self-center text-sm text-muted-foreground">
                      {formatDateShort(weekDate)} al {formatDateShort(addDaysISO(weekDate, 6))}
                    </span>
                  )}
                  <Button variant="outline" onClick={() => setDupOpen(true)}>
                    <Copy /> Duplicar semana
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <Plus /> Día
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {WEEKDAYS.map((d, i) => (
                        <DropdownMenuItem key={i} onSelect={() => run(() => addSession(current.id, i))}>
                          {d}
                          {usedDays.has(i) && <span className="text-muted-foreground"> (ya tiene sesión)</span>}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="icon" aria-label="Eliminar semana" onClick={() => run(() => deleteMicrocycle(current.id))}>
                    <Trash2 />
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-4">
                {sessions.map((s) => (
                  <SessionColumn key={s.id} session={s} date={schedule.sessions[s.id] ?? null} blockTypes={blockTypes} weeks={weekOptions} />
                ))}
                {sessions.length === 0 && (
                  <p className="py-10 text-sm text-muted-foreground">Esta semana no tiene días. Agrega uno con el botón &quot;Día&quot;.</p>
                )}
              </div>
            </div>
            <aside className="sticky top-0 hidden h-[calc(100svh-1px)] w-80 shrink-0 border-l p-4 xl:flex">
              <LibraryPanel className="w-full" />
            </aside>
          </div>
          <DragOverlay dropAnimation={null}>
            {dragging?.type === "lib" ? (
              <LibraryDragPreview ex={dragging.exercise} />
            ) : dragging?.type === "rx" ? (
              <div className="w-72 rounded-md border bg-background px-3 py-2 text-sm font-medium shadow-xl">{dragging.name}</div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {current && <DuplicateWeekDialog open={dupOpen} onOpenChange={setDupOpen} microcycleId={current.id} weekName={current.name} onDone={selectWeek} />}
      <AddMesocycleDialog open={mesoOpen} onOpenChange={setMesoOpen} programId={program.id} />
      {editMeso && <EditMesocycleDialog key={editMeso.id} open={!!editMeso} onOpenChange={(v) => !v && setEditMeso(null)} meso={editMeso} />}
      <ProgramSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} program={program} athletes={athletes} />
    </div>
  );
}
