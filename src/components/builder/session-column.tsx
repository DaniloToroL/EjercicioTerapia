"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, Copy, MoreVertical, Palette, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  addBlock,
  addPrescription,
  deleteBlock,
  deleteSession,
  duplicateSession,
  moveBlock,
  updateBlock,
  updateSession,
} from "@/actions/programs";
import { ExercisePicker } from "@/components/builder/exercise-picker";
import { PrescriptionRow } from "@/components/builder/prescription-row";
import type { BlockTypeOption, BuilderBlock, BuilderSession } from "@/components/builder/types";
import { useRunAction } from "@/components/builder/use-action";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SESSION_COLOR_ORDER, SESSION_COLORS, WEEKDAYS, sessionColor } from "@/lib/constants";
import { formatDateShort } from "@/lib/dates";
import { addVolume, emptyVolume, formatVolume, prescribedVolume } from "@/lib/metrics";
import { cn } from "@/lib/utils";

function blockVolume(block: BuilderBlock) {
  return block.items.reduce((acc, p) => addVolume(acc, prescribedVolume(p.exercise.loadType, p)), emptyVolume());
}

function InlineTitle({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className={cn("min-w-0 truncate text-left hover:underline", className)} title="Editar nombre">
        {value}
      </button>
    );
  }
  return (
    <Input
      autoFocus
      defaultValue={value}
      className="h-7 bg-background text-foreground"
      onBlur={(e) => {
        setEditing(false);
        const v = e.currentTarget.value.trim();
        if (v && v !== value) onSave(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

function BlockCard({ block, color, isFirst, isLast }: { block: BuilderBlock; color: string; isFirst: boolean; isLast: boolean }) {
  const { run } = useRunAction();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: `block:${block.id}`, data: { type: "block", blockId: block.id } });
  const c = sessionColor(color);
  const vol = blockVolume(block);

  return (
    <div className={cn("rounded-lg border", c.soft)}>
      <div className="flex items-center gap-1 px-2 py-1.5">
        <InlineTitle value={block.title} onSave={(title) => run(() => updateBlock(block.id, { title }))} className={cn("flex-1 text-xs font-bold uppercase tracking-wide", c.text)} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label="Opciones del bloque">
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={isFirst} onSelect={() => run(() => moveBlock(block.id, -1))}>
              <ArrowUp /> Subir
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isLast} onSelect={() => run(() => moveBlock(block.id, 1))}>
              <ArrowDown /> Bajar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => run(() => deleteBlock(block.id))}>
              <Trash2 /> Eliminar bloque
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div ref={setNodeRef} className={cn("space-y-1 px-1.5 pb-1.5 transition-colors", isOver && "rounded-md bg-primary/10")}>
        <SortableContext items={block.items.map((p) => `rx:${p.id}`)} strategy={verticalListSortingStrategy}>
          {block.items.map((p) => (
            <PrescriptionRow key={p.id} item={p} />
          ))}
        </SortableContext>
        {block.items.length === 0 && <p className="rounded-md border border-dashed py-2 text-center text-xs text-muted-foreground">Arrastra ejercicios aquí</p>}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <Button variant="ghost" size="xs" onClick={() => setPickerOpen(true)}>
            <Plus /> Ejercicio
          </Button>
          {block.items.length > 0 && <span className="text-[11px] tabular-nums text-muted-foreground">Vol. {formatVolume(vol)}</span>}
        </div>
      </div>
      <ExercisePicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={(e) => run(() => addPrescription(block.id, e.id))} />
    </div>
  );
}

export function SessionColumn({
  session,
  date,
  blockTypes,
  weeks,
}: {
  session: BuilderSession;
  date: string | null;
  blockTypes: BlockTypeOption[];
  weeks: { id: string; label: string }[];
}) {
  const { run } = useRunAction();
  const c = sessionColor(session.color);
  const total = session.blocks.reduce((acc, b) => addVolume(acc, blockVolume(b)), emptyVolume());

  return (
    <div className="flex w-[320px] shrink-0 flex-col gap-2">
      <div className={cn("rounded-lg px-3 py-2", c.header)}>
        <div className="flex items-center gap-2">
          <InlineTitle value={session.name} onSave={(name) => run(() => updateSession(session.id, { name }))} className="flex-1 font-bold uppercase" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" className="text-current hover:bg-white/20 hover:text-current" aria-label="Opciones del día">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Plus /> Agregar bloque
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {blockTypes.map((bt) => (
                    <DropdownMenuItem key={bt.id} onSelect={() => run(() => addBlock(session.id, bt.id))}>
                      {bt.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => run(() => addBlock(session.id, null, "Bloque"))}>
                    <Pencil /> Bloque libre
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Palette /> Color
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {SESSION_COLOR_ORDER.map((key) => (
                    <DropdownMenuItem key={key} onSelect={() => run(() => updateSession(session.id, { color: key }))}>
                      <span className={cn("size-3 rounded-full", SESSION_COLORS[key].header)} /> {SESSION_COLORS[key].label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Copy /> Duplicar día en
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuLabel>Semana de destino</DropdownMenuLabel>
                  {weeks.map((w) => (
                    <DropdownMenuItem key={w.id} onSelect={() => run(() => duplicateSession(session.id, w.id), "Día duplicado")}>
                      {w.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => run(() => deleteSession(session.id))}>
                <Trash2 /> Eliminar día
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs opacity-90">
          <Select value={String(session.weekday)} onValueChange={(v) => run(() => updateSession(session.id, { weekday: Number(v) }))}>
            <SelectTrigger size="sm" className="h-6 w-auto border-white/30 bg-transparent px-2 text-xs text-current [&_svg]:text-current!">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((d, i) => (
                <SelectItem key={i} value={String(i)}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {date && <span>{formatDateShort(date)}</span>}
        </div>
      </div>
      {session.blocks.map((b, i) => (
        <BlockCard key={b.id} block={b} color={session.color} isFirst={i === 0} isLast={i === session.blocks.length - 1} />
      ))}
      <div className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white dark:bg-neutral-800">
        Volumen planificado: <span className="tabular-nums">{formatVolume(total)}</span>
      </div>
    </div>
  );
}
