"use client";

import { CalendarPlus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { assignProgram, createProgram } from "@/actions/programs";
import type { MesocycleGoal } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GOAL_DEFAULTS } from "@/lib/constants";

export type AthleteOption = { id: string; name: string; isSelf?: boolean };

function nextMondayISO() {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() + (dow === 0 ? 0 : 7 - dow));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function GoalSelect({ value, onChange }: { value: MesocycleGoal; onChange: (v: MesocycleGoal) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as MesocycleGoal)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(GOAL_DEFAULTS) as MesocycleGoal[]).map((g) => (
          <SelectItem key={g} value={g}>
            {GOAL_DEFAULTS[g].label}
            <span className="text-muted-foreground"> ({GOAL_DEFAULTS[g].hint.toLowerCase()})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AthleteSelect({ athletes, value, onChange }: { athletes: AthleteOption[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Selecciona un atleta" />
      </SelectTrigger>
      <SelectContent>
        {athletes.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name}
            {a.isSelf ? " (yo)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function NewProgramDialog({ athletes, defaultAthleteId }: { athletes: AthleteOption[]; defaultAthleteId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [isTemplate, setIsTemplate] = useState(false);
  const [athleteId, setAthleteId] = useState(defaultAthleteId ?? "");
  const [goal, setGoal] = useState<MesocycleGoal>("HYPERTROPHY");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    const res = await createProgram({
      name: String(f.get("name") ?? ""),
      isTemplate,
      athleteId: isTemplate ? null : athleteId || null,
      startDate: isTemplate ? null : String(f.get("startDate") ?? "") || null,
      goal,
      mesocycleName: String(f.get("mesocycleName") ?? ""),
      weeks: Number(f.get("weeks") ?? 4),
      daysPerWeek: Number(f.get("days") ?? 4),
    });
    setPending(false);
    if (!res.ok || !res.data) {
      toast.error(res.ok ? "Error inesperado" : res.error);
      return;
    }
    setOpen(false);
    router.push(`/coach/programas/${res.data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Nuevo programa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo programa</DialogTitle>
          <DialogDescription>Se crea el primer mesociclo con sus semanas y días vacíos, listos para llenar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" placeholder="Ej: Temporada 2026 segundo semestre" required />
          </div>
          <label className="flex items-center justify-between gap-4 rounded-md border p-3">
            <span className="text-sm">
              <span className="font-medium">Guardar como plantilla</span>
              <span className="block text-muted-foreground">Para reutilizar y asignar a varios atletas.</span>
            </span>
            <Switch checked={isTemplate} onCheckedChange={setIsTemplate} />
          </label>
          {!isTemplate && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Atleta</Label>
                <AthleteSelect athletes={athletes} value={athleteId} onChange={setAthleteId} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="startDate">Inicio (se ajusta al lunes)</Label>
                <Input id="startDate" name="startDate" type="date" defaultValue={nextMondayISO()} required />
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label>Tipo del primer mesociclo</Label>
            <GoalSelect value={goal} onChange={setGoal} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mesocycleName">Nombre del mesociclo (opcional)</Label>
            <Input id="mesocycleName" name="mesocycleName" placeholder={`Mesociclo 1: ${GOAL_DEFAULTS[goal].label}`} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="weeks">Semanas</Label>
              <Input id="weeks" name="weeks" type="number" min={1} max={12} defaultValue={4} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="days">Días por semana</Label>
              <Input id="days" name="days" type="number" min={1} max={7} defaultValue={4} required />
            </div>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Creando..." : "Crear y abrir constructor"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AssignProgramDialog({
  sourceId,
  sourceName,
  athletes,
  defaultAthleteId,
  trigger,
}: {
  sourceId: string;
  sourceName: string;
  athletes: AthleteOption[];
  defaultAthleteId?: string;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [athleteId, setAthleteId] = useState(defaultAthleteId ?? "");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!athleteId) {
      toast.error("Selecciona un atleta");
      return;
    }
    setPending(true);
    const res = await assignProgram({ sourceId, athleteId, startDate: String(f.get("startDate") ?? ""), name: String(f.get("name") ?? "") });
    setPending(false);
    if (!res.ok || !res.data) {
      toast.error(res.ok ? "Error inesperado" : res.error);
      return;
    }
    toast.success("Programa asignado");
    setOpen(false);
    router.push(`/coach/programas/${res.data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <CalendarPlus className="size-4" /> Asignar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar programa</DialogTitle>
          <DialogDescription>Se crea una copia de &quot;{sourceName}&quot; para el atleta. Los cambios posteriores a la plantilla no la afectan.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Atleta</Label>
            <AthleteSelect athletes={athletes} value={athleteId} onChange={setAthleteId} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="startDate">Inicio (se ajusta al lunes)</Label>
            <Input id="startDate" name="startDate" type="date" defaultValue={nextMondayISO()} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre (opcional)</Label>
            <Input id="name" name="name" placeholder={sourceName} />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Asignando..." : "Asignar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
