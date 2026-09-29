"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createAthlete, updateAthlete } from "@/actions/athletes";
import { InviteLink } from "@/components/coach/invite-link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Athlete = { id: string; name: string; email: string; bodyWeightKg: number | null; notes: string | null };

export function AthleteFormDialog({ athlete, trigger }: { athlete?: Athlete; trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [invite, setInvite] = useState<{ path: string; name: string; id: string } | null>(null);

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
    const res = athlete ? await updateAthlete(athlete.id, input) : await createAthlete(input);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (athlete) {
      toast.success("Datos actualizados");
      setOpen(false);
      router.refresh();
    } else if (res.data && "invitePath" in res.data) {
      setInvite({ path: res.data.invitePath, name: input.name, id: res.data.id });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v && invite) {
          router.push(`/coach/atletas/${invite.id}`);
          setInvite(null);
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
        {invite ? (
          <>
            <DialogHeader>
              <DialogTitle>Atleta creado</DialogTitle>
              <DialogDescription>Comparte este link con {invite.name} para que cree su contraseña y entre desde el teléfono.</DialogDescription>
            </DialogHeader>
            <InviteLink path={invite.path} name={invite.name} />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{athlete ? "Editar atleta" : "Nuevo atleta"}</DialogTitle>
              <DialogDescription>
                {athlete ? "Actualiza los datos del atleta." : "Se genera un link de activación para compartir por WhatsApp."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" name="name" defaultValue={athlete?.name} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={athlete?.email} required />
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
