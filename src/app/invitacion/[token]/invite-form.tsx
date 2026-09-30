"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { acceptInvite } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteForm({ token }: { token: string }) {
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password") ?? "");
    if (password !== String(f.get("confirm") ?? "")) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await acceptInvite({ token, password, consent: consent as true });
    if (!res.ok || !res.data) {
      setError(res.ok ? "Error inesperado" : res.error);
      setPending(false);
      return;
    }
    await signIn("credentials", { email: res.data.email, password, redirect: false });
    // Recarga completa para que el servidor lea la cookie de sesión nueva y redirija según el rol.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm">Repite la contraseña</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
        <span>
          Autorizo el tratamiento de mis datos de entrenamiento y salud (sueño, dolor, estrés, cargas y RPE) para planificar y
          ajustar mi entrenamiento. Puedo pedir su exportación o eliminación en cualquier momento.
        </span>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending || !consent}>
        {pending ? "Activando..." : "Activar cuenta"}
      </Button>
    </form>
  );
}
