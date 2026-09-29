"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreVertical, Replace, SlidersHorizontal, Trash2, Video } from "lucide-react";
import { useState } from "react";
import { deletePrescription, replacePrescriptionExercise, updatePrescription } from "@/actions/programs";
import { ExercisePicker } from "@/components/builder/exercise-picker";
import type { BuilderPrescription } from "@/components/builder/types";
import { useRunAction } from "@/components/builder/use-action";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function numOrNull(v: string) {
  const clean = v.trim().replace(",", ".");
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

/** Celda editable estilo planilla: guarda al salir si el valor cambió. */
function Cell({
  value,
  onSave,
  label,
  inputMode = "decimal",
  className,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  label: string;
  inputMode?: "decimal" | "numeric" | "text";
  className?: string;
  placeholder?: string;
}) {
  return (
    <Input
      key={value}
      defaultValue={value}
      aria-label={label}
      title={label}
      placeholder={placeholder}
      inputMode={inputMode}
      onBlur={(e) => {
        if (e.currentTarget.value.trim() !== value) onSave(e.currentTarget.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={cn("h-7 px-1.5 text-center text-sm tabular-nums", className)}
    />
  );
}

export function PrescriptionRow({ item, readOnlyReason }: { item: BuilderPrescription; readOnlyReason?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `rx:${item.id}`,
    data: { type: "rx", blockId: item.blockId },
  });
  const { run } = useRunAction();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const ex = item.exercise;
  const isTime = ex.loadType === "TIME";
  const showKg = ex.loadType === "EXTERNAL" || ex.loadType === "BODYWEIGHT";

  const save = (data: Parameters<typeof updatePrescription>[1]) => run(() => updatePrescription(item.id, data));

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group rounded-md border bg-background p-1.5", isDragging && "z-10 opacity-60 shadow-lg")}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          aria-label="Arrastrar para mover"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        {item.group && <span className="mt-0.5 rounded bg-muted px-1 text-xs font-semibold">{item.group}</span>}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => ex.videoProvider !== "NONE" && setVideoOpen(true)}
            className={cn("block w-full truncate text-left text-sm font-medium", ex.videoProvider !== "NONE" && "text-blue-700 hover:underline dark:text-blue-400")}
            title={ex.name}
          >
            {ex.videoProvider !== "NONE" && <Video className="mr-1 inline size-3.5 align-[-2px]" />}
            {ex.name}
          </button>
          {(item.notes || item.tempo || item.restSec || item.loadPct) && (
            <p className="truncate text-xs text-muted-foreground">
              {[item.notes, item.tempo && `Tempo ${item.tempo}`, item.restSec && `Descanso ${item.restSec}s`, item.loadPct && `${item.loadPct}% 1RM`]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label="Opciones">
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setPickerOpen(true)}>
              <Replace /> Cambiar ejercicio
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={!!readOnlyReason} onSelect={() => run(() => deletePrescription(item.id))}>
              <Trash2 /> Quitar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-1 grid grid-cols-[1fr_1.4fr_1fr_1fr_auto] items-center gap-1 pl-6">
        <Cell label="Series" inputMode="numeric" value={String(item.sets)} onSave={(v) => save({ sets: Math.max(1, Math.round(numOrNull(v) ?? 1)) })} />
        <Cell label={isTime ? "Tiempo" : "Repeticiones"} inputMode="text" value={item.repsText ?? ""} placeholder={isTime ? "s" : "reps"} onSave={(v) => save({ repsText: v.trim() || null })} />
        {showKg ? (
          <Cell label="Kg" value={item.loadKg != null ? String(item.loadKg).replace(".", ",") : ""} placeholder="kg" onSave={(v) => save({ loadKg: numOrNull(v) })} />
        ) : (
          <span className="text-center text-xs text-muted-foreground">{ex.loadType === "BAND" ? "banda" : ex.loadType === "CONTACTS" ? "cont." : "-"}</span>
        )}
        <Cell label="RPE objetivo" value={item.rpeTarget != null ? String(item.rpeTarget).replace(".", ",") : ""} placeholder="RPE" onSave={(v) => save({ rpeTarget: numOrNull(v) })} />
        <DetailsPopover item={item} onSave={save} />
      </div>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Cambiar ejercicio"
        onPick={(e) => run(() => replacePrescriptionExercise(item.id, e.id))}
      />
      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{ex.name}</DialogTitle>
          </DialogHeader>
          <VideoPlayer provider={ex.videoProvider} url={ex.videoUrl} title={ex.name} autoLoad />
          {ex.instructions && <p className="text-sm text-muted-foreground">{ex.instructions}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailsPopover({ item, onSave }: { item: BuilderPrescription; onSave: (d: Parameters<typeof updatePrescription>[1]) => void }) {
  const [open, setOpen] = useState(false);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim() || null;
    const rest = numOrNull(String(f.get("restSec") ?? ""));
    onSave({
      notes: s("notes"),
      tempo: s("tempo"),
      restSec: rest != null ? Math.round(rest) : null,
      loadPct: numOrNull(String(f.get("loadPct") ?? "")),
      group: s("group")?.toUpperCase() ?? null,
    });
    setOpen(false);
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label="Detalles: notas, tempo, descanso">
          <SlidersHorizontal />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`notes-${item.id}`}>Nota para el atleta</Label>
            <Input id={`notes-${item.id}`} name="notes" defaultValue={item.notes ?? ""} placeholder='Ej: 3" de pausa, 12,5 x mano' />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`tempo-${item.id}`}>Tempo</Label>
              <Input id={`tempo-${item.id}`} name="tempo" defaultValue={item.tempo ?? ""} placeholder="3-1-1" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`rest-${item.id}`}>Descanso (s)</Label>
              <Input id={`rest-${item.id}`} name="restSec" inputMode="numeric" defaultValue={item.restSec ?? ""} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`pct-${item.id}`}>% 1RM</Label>
              <Input id={`pct-${item.id}`} name="loadPct" inputMode="decimal" defaultValue={item.loadPct ?? ""} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`group-${item.id}`}>Superserie</Label>
              <Input id={`group-${item.id}`} name="group" maxLength={3} defaultValue={item.group ?? ""} placeholder="A1" />
            </div>
          </div>
          <Button type="submit" size="sm">
            Guardar
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
