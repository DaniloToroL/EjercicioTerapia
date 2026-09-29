"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function useOrigin() {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Sin permiso de portapapeles (http o navegador antiguo): copia con un textarea temporal.
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

/** Link para compartir por WhatsApp o copiar y pegar. No depende de un servicio de email. */
export function InviteLink({
  path,
  name,
  message,
  note = "El link vence en 14 días. También sirve para restablecer la contraseña.",
}: {
  path: string;
  name: string;
  message?: string;
  note?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const url = `${useOrigin()}${path}`;
  const text = `${message ?? `Hola ${name.split(" ")[0]}, activa tu cuenta de entrenamiento en este link:`} ${url}`;

  async function copy() {
    await copyText(url);
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
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
          <MessageCircle className="size-4" /> Enviar por WhatsApp
        </a>
      </Button>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Botón compacto para copiar el link de un atleta desde una tabla. */
export function CopyLinkButton({ path, className }: { path: string; className?: string }) {
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(className)}
      aria-label="Copiar link del atleta"
      title="Copiar link del atleta"
      onClick={async () => {
        await copyText(`${origin}${path}`);
        setCopied(true);
        toast.success("Link copiado");
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}
