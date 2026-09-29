"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Search, Video } from "lucide-react";
import { useState } from "react";
import type { LibraryExercise } from "@/actions/exercises";
import { useExerciseSearch } from "@/components/builder/exercise-picker";
import type { MovementPattern } from "@/generated/prisma/enums";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PATTERN_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

function LibraryItem({ ex }: { ex: LibraryExercise }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `lib:${ex.id}`, data: { type: "lib", exercise: ex } });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "flex cursor-grab touch-none items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm hover:border-primary/40 active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{ex.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {PATTERN_LABELS[ex.pattern]}
          {ex.equipment.length ? `, ${ex.equipment.join(", ")}` : ""}
        </span>
      </span>
      {ex.videoProvider !== "NONE" && <Video className="size-3.5 shrink-0 text-blue-600" aria-label="Tiene video" />}
    </div>
  );
}

export function LibraryDragPreview({ ex }: { ex: LibraryExercise }) {
  return (
    <div className="flex w-64 items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm shadow-xl">
      <GripVertical className="size-3.5 text-muted-foreground" />
      <span className="truncate font-medium">{ex.name}</span>
    </div>
  );
}

export function LibraryPanel({ className }: { className?: string }) {
  const [q, setQ] = useState("");
  const [pattern, setPattern] = useState<MovementPattern | "ALL">("ALL");
  const [source, setSource] = useState<"ALL" | "mine" | "dataset">("ALL");
  const { results, loading } = useExerciseSearch(q, { pattern, source, take: 80 });

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div>
        <h2 className="font-semibold">Biblioteca</h2>
        <p className="text-xs text-muted-foreground">Arrastra un ejercicio a cualquier bloque.</p>
      </div>
      <div className="relative">
        <Search className="absolute top-2 left-2 size-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className="pl-8" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={pattern} onValueChange={(v) => setPattern(v as MovementPattern | "ALL")}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los patrones</SelectItem>
            {(Object.keys(PATTERN_LABELS) as MovementPattern[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PATTERN_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las fuentes</SelectItem>
            <SelectItem value="mine">Mi biblioteca</SelectItem>
            <SelectItem value="dataset">Catálogo base</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="-mr-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-2">
        {results.map((ex) => (
          <LibraryItem key={ex.id} ex={ex} />
        ))}
        {!loading && results.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sin resultados</p>}
        {loading && results.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Buscando...</p>}
      </div>
    </div>
  );
}
