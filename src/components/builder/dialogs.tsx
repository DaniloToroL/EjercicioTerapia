"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addMesocycle, deleteProgram, duplicateMicrocycle, saveAsTemplate, updateMesocycle, updateProgram, type Progression } from "@/actions/programs";
import { AthleteSelect, GoalSelect, type AthleteOption } from "@/components/coach/program-dialogs";
import type { BuilderMesocycle, BuilderProgram } from "@/components/builder/types";
import { useRunAction } from "@/components/builder/use-action";
import type { MesocycleGoal } from "@/generated/prisma/enums";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toISODate } from "@/lib/dates";

function num(f: FormData, k: string) {
  const v = String(f.get(k) ?? "").replace(",", ".").trim();
  const n = Number(v);
  return v && Number.isFinite(n) ? n : 0;
}

function ProgressionFields({ perWeek }: { perWeek?: boolean }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">
        Progresión {perWeek ? "por semana" : "respecto de la semana copiada"}. Deja en 0 lo que no cambia. Los kg solo se suman donde hay carga definida.
      </p>
      <div className="grid grid-cols-4 gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="addKg">+ kg</Label>
          <Input id="addKg" name="addKg" inputMode="decimal" defaultValue="0" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="addReps">+ reps</Label>
          <Input id="addReps" name="addReps" inputMode="numeric" defaultValue="0" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="addSets">+ series</Label>
          <Input id="addSets" name="addSets" inputMode="numeric" defaultValue="0" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="addRpe">+ RPE</Label>
          <Input id="addRpe" name="addRpe" inputMode="decimal" defaultValue="0" />
        </div>
      </div>
    </div>
  );
}

function readProgression(f: FormData): Progression {
  return { addKg: num(f, "addKg"), addReps: Math.round(num(f, "addReps")), addSets: Math.round(num(f, "addSets")), addRpe: num(f, "addRpe") };
}

export function DuplicateWeekDialog({
  open,
  onOpenChange,
  microcycleId,
  weekName,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  microcycleId: string;
  weekName: string;
  onDone: (newId: string) => void;
}) {
  const { run, pending } = useRunAction();
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const res = await run(() => duplicateMicrocycle(microcycleId, readProgression(new FormData(e.currentTarget))), "Semana duplicada");
    if (res.ok && res.data) {
      onOpenChange(false);
      onDone(res.data.id);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicar {weekName}</DialogTitle>
          <DialogDescription>Crea la semana siguiente con los mismos días, bloques y ejercicios.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <ProgressionFields />
          <Button type="submit" disabled={pending}>
            {pending ? "Duplicando..." : "Duplicar semana"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddMesocycleDialog({ open, onOpenChange, programId }: { open: boolean; onOpenChange: (v: boolean) => void; programId: string }) {
  const { run, pending } = useRunAction();
  const [goal, setGoal] = useState<MesocycleGoal>("HYPERTROPHY");
  const [copy, setCopy] = useState(true);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await run(
      () =>
        addMesocycle(programId, {
          name: String(f.get("name") ?? ""),
          goal,
          weeks: num(f, "weeks") || 4,
          copyLastWeek: copy,
          progression: copy ? readProgression(f) : undefined,
        }),
      "Mesociclo agregado",
    );
    if (res.ok) onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo mesociclo</DialogTitle>
          <DialogDescription>Se agrega al final del programa.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <GoalSelect value={goal} onChange={setGoal} />
          </div>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre (opcional)</Label>
              <Input id="name" name="name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="weeks">Semanas</Label>
              <Input id="weeks" name="weeks" type="number" min={1} max={12} defaultValue={4} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={copy} onCheckedChange={(v) => setCopy(v === true)} />
            Partir de la última semana del programa
          </label>
          {copy && <ProgressionFields perWeek />}
          <Button type="submit" disabled={pending}>
            {pending ? "Creando..." : "Agregar mesociclo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditMesocycleDialog({ open, onOpenChange, meso }: { open: boolean; onOpenChange: (v: boolean) => void; meso: BuilderMesocycle }) {
  const { run, pending } = useRunAction();
  const [goal, setGoal] = useState<MesocycleGoal>(meso.goal);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await run(() => updateMesocycle(meso.id, { name: String(f.get("name") ?? ""), goal, notes: String(f.get("notes") ?? "") || null }));
    if (res.ok) onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar mesociclo</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="meso-name">Nombre</Label>
            <Input id="meso-name" name="name" defaultValue={meso.name} />
          </div>
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <GoalSelect value={goal} onChange={setGoal} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="meso-notes">Objetivo o notas</Label>
            <Textarea id="meso-notes" name="notes" defaultValue={meso.notes ?? ""} rows={3} />
          </div>
          <Button type="submit" disabled={pending}>
            Guardar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProgramSettingsDialog({
  open,
  onOpenChange,
  program,
  athletes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  program: BuilderProgram;
  athletes: AthleteOption[];
}) {
  const router = useRouter();
  const { run, pending } = useRunAction();
  const [athleteId, setAthleteId] = useState(program.athleteId ?? "");
  const [active, setActive] = useState(program.active);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await run(
      () =>
        updateProgram(program.id, {
          name: String(f.get("name") ?? ""),
          description: String(f.get("description") ?? "") || null,
          ...(program.isTemplate ? {} : { startDate: String(f.get("startDate") ?? "") || null, athleteId: athleteId || null, active }),
        }),
      "Programa actualizado",
    );
    if (res.ok) onOpenChange(false);
  }

  async function onTemplate() {
    const res = await run(() => saveAsTemplate(program.id), "Plantilla creada");
    if (res.ok && res.data) router.push(`/coach/programas/${res.data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar programa</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="p-name">Nombre</Label>
            <Input id="p-name" name="name" defaultValue={program.name} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-desc">Descripción</Label>
            <Textarea id="p-desc" name="description" defaultValue={program.description ?? ""} rows={2} />
          </div>
          {!program.isTemplate && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Atleta</Label>
                  <AthleteSelect athletes={athletes} value={athleteId} onChange={setAthleteId} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="p-start">Inicio (lunes)</Label>
                  <Input id="p-start" name="startDate" type="date" defaultValue={program.startDate ? toISODate(program.startDate) : ""} />
                </div>
              </div>
              <label className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span>Programa activo (visible para el atleta)</span>
                <Switch checked={active} onCheckedChange={setActive} />
              </label>
            </>
          )}
          <Button type="submit" disabled={pending}>
            Guardar
          </Button>
        </form>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {!program.isTemplate && (
            <Button variant="outline" size="sm" onClick={onTemplate} disabled={pending}>
              Guardar como plantilla
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
            Eliminar programa
          </Button>
        </div>
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar &quot;{program.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                Si el atleta ya registró sesiones, el programa se archiva para no perder su historial. Si no, se elimina definitivamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteProgram(program.id)}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
