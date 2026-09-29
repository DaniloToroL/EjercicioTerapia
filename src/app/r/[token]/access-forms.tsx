"use client";

import { signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { acceptOpenAccess, activateByAccessLink } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CONSENT_TEXT =
  "Autorizo el tratamiento de mis datos de entrenamiento y salud (sueño, dolor, estrés, cargas y RPE) para planificar y ajustar mi entrenamiento. Puedo pedir su exportación o eliminación en cualquier momento.";

function goToApp() {
  // Recarga completa para que el servidor lea la cookie de sesión nueva.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/atleta");
}

function ConsentCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 text-sm text-muted-foreground">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <span>{CONSENT_TEXT}</span>
    </label>
  );
}

/** Link abierto: entra directo. La primera vez pide el consentimiento de datos. */
export function OpenAccess({ token, needsConsent, otherSession }: { token: string; needsConsent: boolean; otherSession: string | null }) {
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const autoStarted = useRef(false);

  async function enter() {
    setPending(true);
    setError(null);
    const res = await acceptOpenAccess(token, consent);
    if (!res.ok) {
      setError(res.error);
      setPending(false);
      return;
    }
    const login = await signIn("access-link", { token, redirect: false });
    if (!login || login.error) {
      setError("No se pudo abrir tu entrenamiento. Pide el link actualizado a tu entrenador.");
      setPending(false);
      return;
    }
    goToApp();
  }

  // Si no hay nada que confirmar, entra solo.
  const auto = !needsConsent && !otherSession;
  useEffect(() => {
    if (!auto || autoStarted.current) return;
    autoStarted.current = true;
    void enter();
    // enter solo depende del token, que no cambia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  if (auto && !error) return <p className="text-center text-sm text-muted-foreground">Abriendo tu entrenamiento...</p>;

  return (
    <div className="grid gap-4">
      {otherSession && <p className="text-sm text-muted-foreground">Ahora estás conectado como {otherSession}. Al entrar se cerrará esa sesión.</p>}
      {needsConsent && <ConsentCheckbox checked={consent} onChange={setConsent} />}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="h-11" disabled={pending || (needsConsent && !consent)} onClick={enter}>
        {pending ? "Abriendo..." : "Ver mi entrenamiento"}
      </Button>
    </div>
  );
}

/** Link con login y sin contraseña todavía: el atleta crea la suya. */
export function ActivateForm({ token, otherSession }: { token: string; otherSession: string | null }) {
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
    const res = await activateByAccessLink({ token, password, consent: consent as true });
    if (!res.ok || !res.data) {
      setError(res.ok ? "Error inesperado" : res.error);
      setPending(false);
      return;
    }
    await signIn("credentials", { email: res.data.email, password, redirect: false });
    goToApp();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {otherSession && <p className="text-sm text-muted-foreground">Ahora estás conectado como {otherSession}. Al activar se cerrará esa sesión.</p>}
      <div className="grid gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm">Repite la contraseña</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <ConsentCheckbox checked={consent} onChange={setConsent} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending || !consent}>
        {pending ? "Activando..." : "Activar cuenta"}
      </Button>
    </form>
  );
}
