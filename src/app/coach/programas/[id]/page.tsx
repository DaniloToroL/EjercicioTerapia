import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProgramBuilder } from "@/components/builder/program-builder";
import { getAthleteOptions } from "@/lib/athletes";
import { requireCoach } from "@/lib/auth";
import { mondayOf, todayISO } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getProgramFull } from "@/lib/queries";
import { computeSchedule } from "@/lib/schedule";

export const metadata: Metadata = { title: "Constructor" };

export default async function ProgramPage({ params, searchParams }: PageProps<"/coach/programas/[id]">) {
  const coach = await requireCoach();
  const { id } = await params;
  const { semana } = await searchParams;
  const [program, blockTypes, athletes] = await Promise.all([
    getProgramFull(id, coach.orgId),
    prisma.blockType.findMany({ where: { orgId: coach.orgId, archived: false }, orderBy: { order: "asc" }, select: { id: true, name: true, key: true } }),
    getAthleteOptions(coach.orgId, coach.id),
  ]);
  if (!program) notFound();

  const { bySession, byMicrocycle } = computeSchedule(program);
  const schedule = {
    sessions: Object.fromEntries([...bySession].map(([k, v]) => [k, v.date])),
    weeks: Object.fromEntries([...byMicrocycle].map(([k, v]) => [k, v.start])),
  };

  // Semana inicial: la indicada en la URL, o la semana en curso si el programa tiene fechas.
  let initialWeekId = typeof semana === "string" ? semana : undefined;
  if (!initialWeekId) {
    const thisMonday = mondayOf(todayISO());
    initialWeekId = [...byMicrocycle].find(([, v]) => v.start === thisMonday)?.[0];
  }

  return <ProgramBuilder program={program} blockTypes={blockTypes} athletes={athletes} schedule={schedule} initialWeekId={initialWeekId} />;
}
