"use client";

import { Timer, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function RestTimer({ endsAt, onClose, onAdd }: { endsAt: number; onClose: () => void; onAdd: (sec: number) => void }) {
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.round((endsAt - now) / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (left === 0) {
      navigator.vibrate?.([200, 100, 200]);
      const t = setTimeout(onClose, 1500);
      return () => clearTimeout(t);
    }
  }, [left, onClose]);

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 px-4">
      <div className="mx-auto flex max-w-lg items-center gap-3 rounded-xl bg-neutral-900 px-4 py-3 text-white shadow-xl">
        <Timer className="size-5 text-amber-400" />
        <span className="flex-1 text-sm">
          Descanso <span className="text-lg font-semibold tabular-nums">{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</span>
        </span>
        <Button size="sm" variant="secondary" onClick={() => onAdd(15)}>
          +15 s
        </Button>
        <Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Cerrar temporizador">
          <X />
        </Button>
      </div>
    </div>
  );
}
