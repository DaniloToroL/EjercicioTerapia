"use client";

import { Building2, KeyRound, MoreVertical, Pencil, Power, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { addCoach, createOrganization, renameOrganization, setOrganizationActive, staffInvite } from "@/actions/admin";
import { InviteLink } from "@/components/coach/invite-link";
import { useRunAction } from "@/components/builder/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Invite = { path: string; name: string } | null;

function InviteResult({ invite, what }: { invite: NonNullable<Invite>; what: string }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{what}</DialogTitle>
        <DialogDescription>Comparte este link con {invite.name} para que cree su contraseña. Vence en 14 días.</DialogDescription>
      </DialogHeader>
      <InviteLink path={invite.path} name={invite.name} note={null} />
    </>
  );
}

export function NewOrganizationDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [invite, setInvite] = useState<Invite>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input = { orgName: String(f.get("orgName") ?? ""), name: String(f.get("name") ?? ""), email: String(f.get("email") ?? "") };
    setPending(true);
    const res = await createOrganization(input);
    setPending(false);
    if (!res.ok || !res.data) return toast.error(res.ok ? "Error inesperado" : res.error);
    setInvite({ path: res.data.invitePath, name: input.name });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Building2 /> Nuevo centro
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setInvite(null);
        }}
      >
        <DialogContent>
          {invite ? (
            <InviteResult invite={invite} what="Centro creado" />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Nuevo centro</DialogTitle>
                <DialogDescription>Se crea con los bloques y umbrales por defecto, y una cuenta dueña que recibe un link de activación.</DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="orgName">Nombre del centro</Label>
                  <Input id="orgName" name="orgName" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ownerName">Nombre del dueño</Label>
                  <Input id="ownerName" name="name" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ownerEmail">Email del dueño</Label>
                  <Input id="ownerEmail" name="email" type="email" required />
                </div>
                <Button type="submit" disabled={pending}>
                  {pending ? "Creando..." : "Crear y generar link"}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function OrganizationActions({
  org,
  staff,
  isHome,
}: {
  org: { id: string; name: string; active: boolean };
  staff: { id: string; name: string; role: string }[];
  isHome: boolean;
}) {
  const { run } = useRunAction();
  const [dialog, setDialog] = useState<"coach" | "rename" | null>(null);
  const [invite, setInvite] = useState<Invite>(null);
  const [pending, setPending] = useState(false);

  async function onAddCoach(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input = { name: String(f.get("name") ?? ""), email: String(f.get("email") ?? "") };
    setPending(true);
    const res = await addCoach(org.id, input);
    setPending(false);
    if (!res.ok || !res.data) return toast.error(res.ok ? "Error inesperado" : res.error);
    setInvite({ path: res.data.invitePath, name: input.name });
  }

  async function onInvite(user: { id: string; name: string }) {
    const res = await staffInvite(user.id);
    if (!res.ok || !res.data) return toast.error(res.ok ? "Error inesperado" : res.error);
    setInvite({ path: res.data.invitePath, name: user.name });
    setDialog(null);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Opciones de ${org.name}`}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onSelect={() => setDialog("coach")}>
            <UserPlus /> Agregar entrenador
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("rename")}>
            <Pencil /> Cambiar nombre
          </DropdownMenuItem>
          {staff.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Link de contraseña para</DropdownMenuLabel>
              {staff.map((s) => (
                <DropdownMenuItem key={s.id} onSelect={() => onInvite(s)}>
                  <KeyRound /> {s.name} <span className="text-muted-foreground">({s.role === "OWNER" ? "dueño" : "entrenador"})</span>
                </DropdownMenuItem>
              ))}
            </>
          )}
          {!isHome && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant={org.active ? "destructive" : "default"}
                onSelect={() => run(() => setOrganizationActive(org.id, !org.active), org.active ? "Centro suspendido" : "Centro reactivado")}
              >
                <Power /> {org.active ? "Suspender centro" : "Reactivar centro"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={dialog !== null || invite !== null}
        onOpenChange={(v) => {
          if (!v) {
            setDialog(null);
            setInvite(null);
          }
        }}
      >
        <DialogContent>
          {invite ? (
            <InviteResult invite={invite} what="Link de acceso" />
          ) : dialog === "coach" ? (
            <>
              <DialogHeader>
                <DialogTitle>Agregar entrenador a {org.name}</DialogTitle>
              </DialogHeader>
              <form onSubmit={onAddCoach} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="coachName">Nombre</Label>
                  <Input id="coachName" name="name" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="coachEmail">Email</Label>
                  <Input id="coachEmail" name="email" type="email" required />
                </div>
                <Button type="submit" disabled={pending}>
                  {pending ? "Creando..." : "Crear y generar link"}
                </Button>
              </form>
            </>
          ) : dialog === "rename" ? (
            <>
              <DialogHeader>
                <DialogTitle>Cambiar nombre</DialogTitle>
              </DialogHeader>
              <form
                className="grid gap-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const name = String(new FormData(e.currentTarget).get("name") ?? "");
                  const res = await run(() => renameOrganization(org.id, name), "Nombre actualizado");
                  if (res.ok) setDialog(null);
                }}
              >
                <Input name="name" defaultValue={org.name} required />
                <Button type="submit">Guardar</Button>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
