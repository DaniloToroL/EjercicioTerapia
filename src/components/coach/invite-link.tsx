"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Link de activación para compartir por WhatsApp o copiar. No depende de un servicio de email. */
export function InviteLink({ path, name }: { path: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const url = `${origin}${path}`;
  const message = `Hola ${name.split(" ")[0]}, activa tu cuenta de entrenamiento en este link: ${url}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
        <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Copiar link">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
      <Button asChild variant="outline" className="w-full">
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
          <MessageCircle className="size-4" /> Enviar por WhatsApp
        </a>
      </Button>
      <p className="text-xs text-muted-foreground">El link vence en 14 días. También sirve para restablecer la contraseña.</p>
    </div>
  );
}
