import type { Metadata } from "next";
import type { Prisma } from "@/generated/prisma/client";
import { MovementPattern } from "@/generated/prisma/enums";
import { PageHeader } from "@/components/app-nav";
import { requireCoach } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LibraryTable } from "./library-table";

export const metadata: Metadata = { title: "Biblioteca" };

const PAGE_SIZE = 50;

export default async function LibraryPage({ searchParams }: PageProps<"/coach/biblioteca">) {
  const coach = await requireCoach();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const pattern = typeof sp.patron === "string" && sp.patron in MovementPattern ? (sp.patron as MovementPattern) : null;
  const source = typeof sp.fuente === "string" ? sp.fuente : "ALL";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.ExerciseWhereInput = {
    OR: [{ orgId: coach.orgId }, { orgId: null }],
    archived: source === "archived",
    AND: [
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { nameEn: { contains: q, mode: "insensitive" } },
              { equipment: { has: q.toLowerCase() } },
              { targetMuscle: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      pattern ? { pattern } : {},
      source === "mine" ? { source: { not: "exercises-dataset" } } : {},
      source === "dataset" ? { source: "exercises-dataset" } : {},
    ],
  };

  const [exercises, total, blockTypes, counts] = await Promise.all([
    prisma.exercise.findMany({
      where,
      orderBy: [{ priority: "desc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        nameEn: true,
        pattern: true,
        loadType: true,
        equipment: true,
        instructions: true,
        defaultBlockKey: true,
        unilateral: true,
        videoProvider: true,
        videoUrl: true,
        source: true,
        archived: true,
        orgId: true,
      },
    }),
    prisma.exercise.count({ where }),
    prisma.blockType.findMany({ where: { orgId: coach.orgId, archived: false }, orderBy: { order: "asc" }, select: { key: true, name: true } }),
    prisma.exercise.groupBy({
      by: ["source"],
      where: { OR: [{ orgId: coach.orgId }, { orgId: null }], archived: false },
      _count: true,
    }),
  ]);

  const own = counts.filter((c) => c.source !== "exercises-dataset").reduce((s, c) => s + c._count, 0);
  const dataset = counts.find((c) => c.source === "exercises-dataset")?._count ?? 0;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="Biblioteca de ejercicios"
        description={`${own} ejercicios de la planilla y propios, y ${dataset} del catálogo base. Toca un ejercicio para ver su video${coach.isSuperadmin ? " o editarlo" : ""}.`}
      />
      <LibraryTable
        exercises={exercises.map(({ orgId, ...e }) => ({ ...e, isGlobal: orgId === null }))}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        blockTypes={blockTypes}
        canEditGlobal={coach.isSuperadmin}
      />
    </div>
  );
}
