"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { addBlockType, moveBlockType, updateBlockType, updateOrgName, updateWellnessThresholds } from "@/actions/settings";
import { useRunAction } from "@/components/builder/use-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WELLNESS_LEVEL_STYLES, type WellnessLevel, type WellnessThreshold } from "@/lib/constants";
import { cn } from "@/lib/utils";

const LEVEL_LABELS: Record<WellnessLevel, string> = { optimal: "Óptimo", good: "Bueno", warning: "Regular", bad: "Deficiente" };

export function OrgNameForm({ name, canEdit }: { name: string; canEdit: boolean }) {
  const { run, pending } = useRunAction();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const v = String(new FormData(e.currentTarget).get("name") ?? "");
        run(() => updateOrgName(v), "Nombre actualizado");
      }}
    >
      <Input name="name" defaultValue={name} disabled={!canEdit} />
      <Button type="submit" disabled={!canEdit || pending}>
        Guardar
      </Button>
    </form>
  );
}

export function ThresholdsForm({ initial }: { initial: WellnessThreshold[] }) {
  const { run, pending } = useRunAction();
  const [rows, setRows] = useState(initial);

  function update(i: number, patch: Partial<WellnessThreshold>) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-3">
      {rows.map((row, i) => {
        const from = i === 0 ? 6 : rows[i - 1].max + 1;
        const last = i === rows.length - 1;
        return (
          <div key={i} className="grid items-center gap-2 sm:grid-cols-[9rem_8rem_1fr_auto]">
            <div className="flex items-center gap-2 text-sm">
              <span className="tabular-nums">{from} a</span>
              <Input
                type="number"
                min={from}
                max={42}
                value={last ? 42 : row.max}
                disabled={last}
                onChange={(e) => update(i, { max: Number(e.target.value) })}
                className="w-20"
              />
            </div>
            <Select value={row.level} onValueChange={(v) => update(i, { level: v as WellnessLevel })}>
              <SelectTrigger className={cn("w-full", WELLNESS_LEVEL_STYLES[row.level])}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LEVEL_LABELS) as WellnessLevel[]).map((l) => (
                  <SelectItem key={l} value={l}>
                    {LEVEL_LABELS[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={row.message} onChange={(e) => update(i, { message: e.target.value })} />
            <Button variant="ghost" size="icon" aria-label="Quitar tramo" disabled={rows.length <= 1} onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
        );
      })}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={rows.length >= 6}
          onClick={() => setRows((r) => [...r.slice(0, -1), { ...r[r.length - 1], max: Math.max(6, r[r.length - 1].max - 5) }, r[r.length - 1]])}
        >
          <Plus /> Tramo
        </Button>
        <Button size="sm" disabled={pending} onClick={() => run(() => updateWellnessThresholds(rows), "Umbrales guardados")}>
          Guardar umbrales
        </Button>
      </div>
    </div>
  );
}

export function BlockTypesForm({ types }: { types: { id: string; name: string; archived: boolean }[] }) {
  const { run } = useRunAction();
  const [name, setName] = useState("");
  return (
    <div className="space-y-2">
      {types.map((t, i) => (
        <div key={t.id} className={cn("flex items-center gap-2", t.archived && "opacity-50")}>
          <Input
            key={t.name}
            defaultValue={t.name}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim();
              if (v && v !== t.name) run(() => updateBlockType(t.id, { name: v }));
            }}
          />
          <Button variant="ghost" size="icon" aria-label="Subir" disabled={i === 0} onClick={() => run(() => moveBlockType(t.id, -1))}>
            <ArrowUp />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Bajar" disabled={i === types.length - 1} onClick={() => run(() => moveBlockType(t.id, 1))}>
            <ArrowDown />
          </Button>
          <Button variant="outline" size="sm" onClick={() => run(() => updateBlockType(t.id, { archived: !t.archived }))}>
            {t.archived ? "Activar" : "Ocultar"}
          </Button>
        </div>
      ))}
      <form
        className="flex gap-2 pt-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await run(() => addBlockType(name));
          if (res.ok) setName("");
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuevo tipo de bloque, ej: Bloque core" />
        <Button type="submit" variant="outline">
          <Plus /> Agregar
        </Button>
      </form>
    </div>
  );
}
