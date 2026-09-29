import { CheckCircle2, ChevronRight, Circle, Clock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { sessionColor } from "@/lib/constants";
import { formatDateLong } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type SessionStatus = "done" | "in-progress" | "pending" | "missed";

export function SessionCard({
  id,
  name,
  color,
  date,
  status,
  exerciseCount,
  subtitle,
  highlight,
}: {
  id: string;
  name: string;
  color: string;
  date: string | null;
  status: SessionStatus;
  exerciseCount: number;
  subtitle?: string;
  highlight?: boolean;
}) {
  const c = sessionColor(color);
  return (
    <Link
      href={`/atleta/sesion/${id}`}
      className={cn("flex items-stretch overflow-hidden rounded-xl border bg-card shadow-xs transition-colors hover:bg-muted/50", highlight && "ring-2 ring-primary")}
    >
      <span className={cn("w-2 shrink-0", c.header)} />
      <span className="flex min-w-0 flex-1 items-center gap-3 p-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold uppercase">{name}</span>
          <span className="block text-sm text-muted-foreground first-letter:uppercase">
            {date ? formatDateLong(date) : "Sin fecha"}
            {subtitle ? `, ${subtitle}` : ""}
          </span>
          <span className="text-xs text-muted-foreground">{exerciseCount} ejercicios</span>
        </span>
        {status === "done" && (
          <Badge className="gap-1 bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
            <CheckCircle2 className="size-3" /> Hecha
          </Badge>
        )}
        {status === "in-progress" && (
          <Badge variant="outline" className="gap-1">
            <Clock className="size-3" /> En curso
          </Badge>
        )}
        {status === "missed" && (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Circle className="size-3" /> Pendiente
          </Badge>
        )}
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </span>
    </Link>
  );
}
