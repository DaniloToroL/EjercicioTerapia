"use client";

import { Video } from "lucide-react";
import { useEffect, useState } from "react";
import { searchExercises, type LibraryExercise } from "@/actions/exercises";
import { Badge } from "@/components/ui/badge";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PATTERN_LABELS } from "@/lib/constants";

export function useExerciseSearch(query: string, filters: Parameters<typeof searchExercises>[0] = {}, enabled = true) {
  const [results, setResults] = useState<LibraryExercise[]>([]);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(filters);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchExercises({ ...JSON.parse(key), q: query });
        if (!cancelled) setResults(r);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, key, enabled]);
  return { results, loading };
}

/** Buscador de ejercicios en un diálogo: la alternativa a arrastrar desde la biblioteca. */
export function ExercisePicker({
  open,
  onOpenChange,
  onPick,
  title = "Agregar ejercicio",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (exercise: LibraryExercise) => void;
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const { results, loading } = useExerciseSearch(query, { take: 40 }, open);
  const own = results.filter((r) => r.source !== "exercises-dataset");
  const dataset = results.filter((r) => r.source === "exercises-dataset");

  function item(ex: LibraryExercise) {
    return (
      <CommandItem
        key={ex.id}
        value={ex.id}
        onSelect={() => {
          onPick(ex);
          onOpenChange(false);
          setQuery("");
        }}
        className="flex items-center justify-between gap-2"
      >
        <span className="min-w-0">
          <span className="block truncate">{ex.name}</span>
          {ex.nameEn && ex.nameEn !== ex.name && <span className="block truncate text-xs text-muted-foreground">{ex.nameEn}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {ex.videoProvider !== "NONE" && <Video className="size-3.5 text-muted-foreground" />}
          <Badge variant="outline" className="text-[10px]">
            {PATTERN_LABELS[ex.pattern]}
          </Badge>
        </span>
      </CommandItem>
    );
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={title} description="Busca por nombre, equipamiento o músculo">
      <Command shouldFilter={false}>
        <CommandInput placeholder="Buscar ejercicio..." value={query} onValueChange={setQuery} />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>{loading ? "Buscando..." : "Sin resultados"}</CommandEmpty>
          {own.length > 0 && <CommandGroup heading="Mi biblioteca">{own.map(item)}</CommandGroup>}
          {dataset.length > 0 && <CommandGroup heading="Catálogo base">{dataset.map(item)}</CommandGroup>}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
