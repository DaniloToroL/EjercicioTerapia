"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createAthlete, updateAthlete } from "@/actions/athletes";
import { ACCESS_MODE_INFO, AccessModePicker } from "@/components/coach/access-link-card";
import { InviteLink } from "@/components/coach/invite-link";
import type { AccessMode } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Athlete = { id: string; name: string; email: string | null; accessMode: AccessMode; bodyWeightKg: number | null; notes: string | null };

export function AthleteFormDialog({ athlete, trigger }: { athlete?: Athlete; trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<AccessMode>(athlete?.accessMode ?? "LOGIN");
  const [created, setCreated] = useState<{ path: string; name: string; id: string; mode: AccessMode } | null>(null);
  const emailRequired = mode === "LOGIN";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const weight = String(f.get("bodyWeightKg") ?? "").replace(",", ".");
    const input = {
      name: String(f.get("name") ?? ""),
      email: String(f.get("email") ?? ""),
      bodyWeightKg: weight ? Number(weight) : null,
      notes: String(f.get("notes") ?? "") || null,
    };
    setPending(true);
    const res = athlete ? await updateAthlete(athlete.id, input) : await createAthlete({ ...input, accessMode: mode });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (athlete) {
      toast.success("Datos actualizados");
      setOpen(false);
      router.refresh();
    } else if (res.data && "accessPath" in res.data) {
      setCreated({ path: res.data.accessPath, name: input.name, id: res.data.id, mode });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v && created) {
          router.push(`/coach/atletas/${created.id}`);
          setCreated(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <UserPlus className="size-4" /> Nuevo atleta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Atleta creado</DialogTitle>
              <DialogDescription>
                Copia este link y compártelo con {created.name}.{" "}
                {created.mode === "OPEN" ? "Entra directo, sin contraseña." : "La primera vez crea su contraseña."} Puedes cambiar el tipo de acceso
                cuando quieras desde su ficha.
              </DialogDescription>
            </DialogHeader>
            <InviteLink path={created.path} name={created.name} message={`Hola ${created.name.split(" ")[0]}, aquí está tu entrenamiento:`} note={null} />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{athlete ? "Editar atleta" : "Nuevo atleta"}</DialogTitle>
              <DialogDescription>
                {athlete ? "Actualiza los datos del atleta." : "Se genera un link personal para copiar y pegar, o enviar por WhatsApp."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" name="name" defaultValue={athlete?.name} required />
              </div>
              {!athlete && (
                <div className="grid gap-2">
                  <Label>Acceso con el link</Label>
                  <AccessModePicker value={mode} onChange={setMode} />
                  <p className="text-xs text-muted-foreground">{ACCESS_MODE_INFO[mode].description}</p>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="email">Email{emailRequired ? "" : " (opcional)"}</Label>
                <Input id="email" name="email" type="email" defaultValue={athlete?.email ?? ""} required={emailRequired} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bodyWeightKg">Peso corporal (kg, opcional)</Label>
                <Input id="bodyWeightKg" name="bodyWeightKg" inputMode="decimal" defaultValue={athlete?.bodyWeightKg ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notas (lesiones, objetivos)</Label>
                <Textarea id="notes" name="notes" defaultValue={athlete?.notes ?? ""} rows={3} />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando..." : athlete ? "Guardar" : "Crear y generar link"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
