"use client";

import { CalendarDays, CloudOff, Home, LineChart, LogOut, MonitorSmartphone } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { flushQueue, pendingCount, subscribePending } from "@/lib/offline-queue";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/atleta", label: "Hoy", icon: Home, exact: true },
  { href: "/atleta/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/atleta/progreso", label: "Progreso", icon: LineChart },
];

/** Indicador de series pendientes de sincronizar y reintento automático al volver la red. */
function SyncIndicator() {
  const [pending, setPending] = useState(0);
  useEffect(() => {
    const unsub = subscribePending(setPending);
    const sync = () => flushQueue().finally(() => setPending(pendingCount()));
    sync();
    window.addEventListener("online", sync);
    const t = setInterval(sync, 30000);
    return () => {
      unsub();
      window.removeEventListener("online", sync);
      clearInterval(t);
    };
  }, []);
  if (!pending) return null;
  return (
    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
      <CloudOff className="size-3" /> {pending} sin sincronizar
    </span>
  );
}

export function AthleteHeader({ name, isCoach }: { name: string; isCoach: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-lg items-center gap-2 px-4">
        <span className="flex-1 truncate font-semibold">Hola, {name.split(" ")[0]}</span>
        <SyncIndicator />
        {isCoach && (
          <Button asChild variant="ghost" size="icon" aria-label="Volver al panel del entrenador">
            <Link href="/coach">
              <MonitorSmartphone />
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label="Cerrar sesión" onClick={async () => {
            // Borra las pantallas guardadas para uso sin señal antes de salir.
            if (typeof caches !== "undefined") await caches.delete("entrenamiento-v1").catch(() => false);
            signOut({ callbackUrl: "/login" });
          }}>
          <LogOut />
        </Button>
      </div>
    </header>
  );
}

export function AthleteTabs() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto grid max-w-lg grid-cols-3">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn("flex flex-col items-center gap-0.5 py-2 text-xs", active ? "text-foreground" : "text-muted-foreground")}
            >
              <t.icon className={cn("size-5", active && "stroke-[2.5]")} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
