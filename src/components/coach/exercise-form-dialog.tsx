"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { archiveExercise, createExercise, updateExercise } from "@/actions/exercises";
import type { LoadType, MovementPattern, VideoProvider } from "@/generated/prisma/enums";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LOAD_TYPE_LABELS, PATTERN_LABELS } from "@/lib/constants";
import { detectVideoProvider } from "@/lib/video";

export type EditableExercise = {
  id: string;
  name: string;
  nameEn: string | null;
  pattern: MovementPattern;
  loadType: LoadType;
  equipment: string[];
  instructions: string | null;
  defaultBlockKey: string | null;
  unilateral: boolean;
  videoProvider: VideoProvider;
  videoUrl: string | null;
  source: string;
  archived: boolean;
  /** Biblioteca global (sin centro): solo la edita el superadmin. */
  isGlobal: boolean;
};

function uploadVideo(exerciseId: string, file: File, onProgress: (p: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/uploads?exerciseId=${encodeURIComponent(exerciseId)}`);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(body.url);
        else reject(new Error(body.error ?? "Error al subir"));
      } catch {
        reject(new Error("Error al subir"));
      }
    };
    xhr.onerror = () => reject(new Error("Error de red al subir el video"));
    xhr.send(file);
  });
}

export function ExerciseFormDialog({
  exercise,
  blockTypes,
  open,
  onOpenChange,
  readOnly = false,
}: {
  exercise?: EditableExercise | null;
  blockTypes: { key: string; name: string }[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [pattern, setPattern] = useState<MovementPattern>(exercise?.pattern ?? "OTHER");
  const [loadType, setLoadType] = useState<LoadType>(exercise?.loadType ?? "EXTERNAL");
  const [blockKey, setBlockKey] = useState(exercise?.defaultBlockKey ?? "none");
  const [unilateral, setUnilateral] = useState(exercise?.unilateral ?? false);
  const [videoUrl, setVideoUrl] = useState(exercise?.videoUrl ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input = {
      name: String(f.get("name") ?? ""),
      nameEn: String(f.get("nameEn") ?? "") || null,
      pattern,
      loadType,
      equipment: String(f.get("equipment") ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      instructions: String(f.get("instructions") ?? "") || null,
      defaultBlockKey: blockKey === "none" ? null : blockKey,
      unilateral,
      videoUrl: file ? (exercise?.videoUrl ?? null) : videoUrl.trim() || null,
    };
    setPending(true);
    const res = exercise ? await updateExercise(exercise.id, input) : await createExercise(input);
    if (!res.ok) {
      setPending(false);
      toast.error(res.error);
      return;
    }
    const id = exercise?.id ?? (res.data as { id: string } | undefined)?.id;
    if (file && id) {
      try {
        setProgress(0);
        await uploadVideo(id, file, setProgress);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al subir el video");
      }
      setProgress(null);
    }
    setPending(false);
    toast.success(exercise ? "Ejercicio actualizado" : "Ejercicio creado");
    onOpenChange(false);
    router.refresh();
  }

  async function toggleArchive() {
    if (!exercise) return;
    const res = await archiveExercise(exercise.id, !exercise.archived);
    if (!res.ok) toast.error(res.error);
    else {
      onOpenChange(false);
      router.refresh();
    }
  }

  const previewProvider = videoUrl ? detectVideoProvider(videoUrl) : "NONE";

  // Biblioteca global: los entrenadores la ven y la usan, pero solo el superadmin la modifica.
  if (readOnly && exercise) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{exercise.name}</DialogTitle>
            <DialogDescription>
              {PATTERN_LABELS[exercise.pattern]}, {LOAD_TYPE_LABELS[exercise.loadType].toLowerCase()}
              {exercise.equipment.length ? `, ${exercise.equipment.join(", ")}` : ""}
            </DialogDescription>
          </DialogHeader>
          {exercise.videoUrl && exercise.videoProvider !== "NONE" && (
            <VideoPlayer provider={exercise.videoProvider} url={exercise.videoUrl} title={exercise.name} />
          )}
          {exercise.instructions && <p className="text-sm text-muted-foreground">{exercise.instructions}</p>}
          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            Este ejercicio es de la biblioteca global de la plataforma y solo lo edita el superadmin. Si necesitas otra versión (otro video o
            nombre), crea un ejercicio propio.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{exercise ? "Editar ejercicio" : "Nuevo ejercicio"}</DialogTitle>
          {exercise?.source === "exercises-dataset" && (
            <DialogDescription>Ejercicio del catálogo base (exercises-dataset, licencia MIT para los datos).</DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ex-name">Nombre</Label>
              <Input id="ex-name" name="name" defaultValue={exercise?.name} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ex-nameEn">Nombre en inglés (opcional)</Label>
              <Input id="ex-nameEn" name="nameEn" defaultValue={exercise?.nameEn ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label>Patrón de movimiento</Label>
              <Select value={pattern} onValueChange={(v) => setPattern(v as MovementPattern)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PATTERN_LABELS) as MovementPattern[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PATTERN_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Tipo de carga (define qué registra el atleta)</Label>
              <Select value={loadType} onValueChange={(v) => setLoadType(v as LoadType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LOAD_TYPE_LABELS) as LoadType[]).map((l) => (
                    <SelectItem key={l} value={l}>
                      {LOAD_TYPE_LABELS[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ex-equipment">Equipamiento (separado por comas)</Label>
              <Input id="ex-equipment" name="equipment" defaultValue={exercise?.equipment.join(", ") ?? ""} placeholder="barra, mancuernas" />
            </div>
            <div className="grid gap-2">
              <Label>Bloque sugerido</Label>
              <Select value={blockKey} onValueChange={setBlockKey}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin bloque sugerido</SelectItem>
                  {blockTypes.map((b) => (
                    <SelectItem key={b.key} value={b.key}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={unilateral} onCheckedChange={(v) => setUnilateral(v === true)} /> Unilateral (se registra por lado)
          </label>
          <div className="grid gap-2">
            <Label htmlFor="ex-instructions">Instrucciones</Label>
            <Textarea id="ex-instructions" name="instructions" rows={3} defaultValue={exercise?.instructions ?? ""} />
          </div>
          <div className="grid gap-2 rounded-lg border p-3">
            <Label htmlFor="ex-video">Video</Label>
            <Input
              id="ex-video"
              value={file ? "" : videoUrl}
              disabled={!!file}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Link de YouTube (https://youtu.be/...)"
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload /> {file ? "Cambiar archivo" : "Subir video propio"}
              </Button>
              {file && (
                <span className="text-sm text-muted-foreground">
                  {file.name} ({Math.round(file.size / 1024 / 1024)} MB)
                  <Button type="button" variant="link" size="sm" onClick={() => setFile(null)}>
                    quitar
                  </Button>
                </span>
              )}
              {!file && videoUrl && (
                <Button type="button" variant="link" size="sm" onClick={() => setVideoUrl("")}>
                  Quitar video
                </Button>
              )}
            </div>
            {progress != null && <Progress value={progress} />}
            {!file && videoUrl && previewProvider !== "NONE" && (
              <VideoPlayer provider={previewProvider} url={videoUrl} title={exercise?.name ?? "Vista previa"} className="max-w-md" />
            )}
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            {exercise ? (
              <Button type="button" variant="ghost" onClick={toggleArchive}>
                {exercise.archived ? "Restaurar" : "Archivar"}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={pending}>
              {pending ? (progress != null ? `Subiendo ${progress}%` : "Guardando...") : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
