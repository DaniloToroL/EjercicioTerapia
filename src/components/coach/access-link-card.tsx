"use client";

import { Globe, KeyRound, RefreshCw } from "lucide-react";
import { useState } from "react";
import { regenerateAccessLink, setAccessMode } from "@/actions/athletes";
import { useRunAction } from "@/components/builder/use-action";
import { InviteLink } from "@/components/coach/invite-link";
import type { AccessMode } from "@/generated/prisma/enums";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const ACCESS_MODE_INFO: Record<AccessMode, { label: string; description: string }> = {
  LOGIN: {
    label: "Con login",
    description: "El link lleva a crear la contraseña la primera vez y después a iniciar sesión. Si alguien más lo abre, no entra sin la contraseña.",
  },
  OPEN: {
    label: "Abierto",
    description: "Quien tenga el link entra directo a la rutina, sin contraseña. Cómodo para invitados; si el link se filtra, genera uno nuevo.",
  },
};

export function AccessModePicker({ value, onChange, disabled }: { value: AccessMode; onChange: (m: AccessMode) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de acceso">
      {(["LOGIN", "OPEN"] as AccessMode[]).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          disabled={disabled}
          onClick={() => onChange(m)}
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50",
            value === m ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
          )}
        >
          {m === "LOGIN" ? <KeyRound className="size-4 shrink-0" /> : <Globe className="size-4 shrink-0" />}
          {ACCESS_MODE_INFO[m].label}
        </button>
      ))}
    </div>
  );
}

/** Link permanente del atleta: elegir si es con login o abierto, copiarlo, enviarlo o reemplazarlo. */
export function AccessLinkCard({
  athleteId,
  name,
  accessPath,
  mode,
  hasEmail,
}: {
  athleteId: string;
  name: string;
  accessPath: string | null;
  mode: AccessMode;
  hasEmail: boolean;
}) {
  const { run, pending } = useRunAction();
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const firstName = name.split(" ")[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link de acceso</CardTitle>
        <CardDescription>Cópialo y pégalo donde quieras. Es el mismo link siempre, salvo que generes uno nuevo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AccessModePicker
          value={mode}
          disabled={pending}
          onChange={(m) => m !== mode && run(() => setAccessMode(athleteId, m), m === "OPEN" ? "Link abierto" : "Link con login")}
        />
        <p className="text-sm text-muted-foreground">{ACCESS_MODE_INFO[mode].description}</p>
        {mode === "OPEN" && !hasEmail && (
          <p className="text-xs text-muted-foreground">Para usar acceso con login, agrega el email del atleta con Editar.</p>
        )}
        {accessPath ? (
          <InviteLink
            path={accessPath}
            name={name}
            message={`Hola ${firstName}, aquí está tu entrenamiento:`}
            note={null}
          />
        ) : (
          <Button variant="outline" onClick={() => run(() => regenerateAccessLink(athleteId))}>
            Generar link
          </Button>
        )}
        {accessPath && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmRegenerate(true)} disabled={pending}>
            <RefreshCw /> Generar link nuevo
          </Button>
        )}
      </CardContent>
      <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reemplazar el link de {firstName}?</AlertDialogTitle>
            <AlertDialogDescription>
              El link actual deja de funcionar y se cierran las sesiones abiertas con él. Tendrás que enviarle el link nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(() => regenerateAccessLink(athleteId), "Link nuevo generado")}>Generar link nuevo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
