"use client";

import { KeyRound, MoreVertical, Pencil, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteAthlete, regenerateInvite, setAthleteActive } from "@/actions/athletes";
import { AthleteFormDialog } from "@/components/coach/athlete-form-dialog";
import { InviteLink } from "@/components/coach/invite-link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AthleteActions({
  athlete,
  isSelf,
}: {
  athlete: { id: string; name: string; email: string; bodyWeightKg: number | null; notes: string | null; active: boolean };
  isSelf: boolean;
}) {
  const router = useRouter();
  const [invitePath, setInvitePath] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function onInvite() {
    const res = await regenerateInvite(athlete.id);
    if (!res.ok || !res.data) toast.error(res.ok ? "Error" : res.error);
    else setInvitePath(res.data.invitePath);
  }

  async function onToggle() {
    const res = await setAthleteActive(athlete.id, !athlete.active);
    if (!res.ok) toast.error(res.error);
    else router.refresh();
  }

  async function onDelete() {
    const res = await deleteAthlete(athlete.id);
    if (!res.ok) toast.error(res.error);
    else router.push("/coach");
  }

  if (isSelf) return null;

  return (
    <>
      <AthleteFormDialog
        athlete={athlete}
        trigger={
          <Button variant="outline">
            <Pencil /> Editar
          </Button>
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Más opciones">
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onInvite}>
            <KeyRound /> Link de activación o nueva contraseña
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggle}>
            <Power /> {athlete.active ? "Desactivar acceso" : "Reactivar acceso"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2 /> Eliminar atleta y sus datos
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!invitePath} onOpenChange={(v) => !v && setInvitePath(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link para {athlete.name}</DialogTitle>
            <DialogDescription>Con este link puede activar su cuenta o definir una contraseña nueva.</DialogDescription>
          </DialogHeader>
          {invitePath && <InviteLink path={invitePath} name={athlete.name} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {athlete.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran su cuenta, programas, registros de series y check-ins. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Eliminar definitivamente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
