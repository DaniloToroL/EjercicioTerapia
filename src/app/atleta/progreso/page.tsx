import type { Metadata } from "next";
import { ProgressCharts } from "@/components/progress-charts";
import { requireUser } from "@/lib/auth";
import { getProgress } from "@/lib/queries";

export const metadata: Metadata = { title: "Progreso" };

export default async function AthleteProgress() {
  const user = await requireUser();
  const data = await getProgress(user.id, user.orgId);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Progreso</h1>
        <p className="text-sm text-muted-foreground">{data.totalWorkouts} sesiones completadas.</p>
      </div>
      <ProgressCharts data={data} />
    </div>
  );
}
