"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { setupOwner } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetupForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const input = {
      orgName: String(f.get("orgName") ?? ""),
      name: String(f.get("name") ?? ""),
      email: String(f.get("email") ?? ""),
      password: String(f.get("password") ?? ""),
    };
    const res = await setupOwner(input);
    if (!res.ok) {
      setError(res.error);
      setPending(false);
      return;
    }
    await signIn("credentials", { email: input.email, password: input.password, redirect: false });
    // Recarga completa para que el servidor lea la cookie de sesión nueva y redirija según el rol.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/coach");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="orgName">Centro o equipo</Label>
        <Input id="orgName" name="orgName" placeholder="Ej: Robotipy Training" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="name">Tu nombre</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Creando..." : "Crear cuenta"}
      </Button>
    </form>
  );
}
