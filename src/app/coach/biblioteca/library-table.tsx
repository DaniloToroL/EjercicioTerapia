"use client";

import { Plus, Video } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ExerciseFormDialog, type EditableExercise } from "@/components/coach/exercise-form-dialog";
import type { MovementPattern } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LOAD_TYPE_LABELS, PATTERN_LABELS } from "@/lib/constants";

const SOURCE_LABELS: Record<string, string> = { planilla: "Planilla", custom: "Propio", "exercises-dataset": "Catálogo base" };

export function LibraryTable({
  exercises,
  total,
  page,
  pageSize,
  blockTypes,
  canEditGlobal,
}: {
  exercises: EditableExercise[];
  total: number;
  page: number;
  pageSize: number;
  blockTypes: { key: string; name: string }[];
  canEditGlobal: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<EditableExercise | null>(null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState(params.get("q") ?? "");

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setParam("q", q.trim() || null);
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, equipamiento o músculo y presiona Enter" />
        </form>
        <Select value={params.get("patron") ?? "ALL"} onValueChange={(v) => setParam("patron", v === "ALL" ? null : v)}>
          <SelectTrigger className="w-48">
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
        <Select value={params.get("fuente") ?? "ALL"} onValueChange={(v) => setParam("fuente", v === "ALL" ? null : v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las fuentes</SelectItem>
            <SelectItem value="mine">Mi biblioteca</SelectItem>
            <SelectItem value="dataset">Catálogo base</SelectItem>
            <SelectItem value="archived">Archivados</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setCreating(true)}>
          <Plus /> Nuevo ejercicio
        </Button>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ejercicio</TableHead>
              <TableHead className="hidden md:table-cell">Patrón</TableHead>
              <TableHead className="hidden lg:table-cell">Carga</TableHead>
              <TableHead className="hidden lg:table-cell">Equipamiento</TableHead>
              <TableHead>Fuente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exercises.map((ex) => (
              <TableRow key={ex.id} className="cursor-pointer" onClick={() => setEditing(ex)}>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium">
                    {ex.videoProvider !== "NONE" && <Video className="size-4 shrink-0 text-blue-600" aria-label="Tiene video" />}
                    {ex.name}
                  </div>
                  {ex.nameEn && ex.nameEn !== ex.name && <div className="text-xs text-muted-foreground">{ex.nameEn}</div>}
                </TableCell>
                <TableCell className="hidden md:table-cell">{PATTERN_LABELS[ex.pattern]}</TableCell>
                <TableCell className="hidden lg:table-cell">{LOAD_TYPE_LABELS[ex.loadType]}</TableCell>
                <TableCell className="hidden max-w-48 truncate lg:table-cell">{ex.equipment.join(", ")}</TableCell>
                <TableCell>
                  <Badge variant={ex.source === "exercises-dataset" ? "outline" : "secondary"}>{SOURCE_LABELS[ex.source] ?? ex.source}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {exercises.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Sin resultados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} ejercicios, página {page} de {pages}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setParam("page", String(page + 1))}>
            Siguiente
          </Button>
        </div>
      </div>

      {editing && (
        <ExerciseFormDialog
          key={editing.id}
          exercise={editing}
          blockTypes={blockTypes}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          readOnly={editing.isGlobal && !canEditGlobal}
        />
      )}
      {creating && <ExerciseFormDialog blockTypes={blockTypes} open={creating} onOpenChange={setCreating} />}
    </div>
  );
}
