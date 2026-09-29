import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SessionRunner } from "@/components/athlete/session-runner";
import { getSessionView } from "@/lib/athlete-view";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sesión" };

export default async function SessionPage({ params }: PageProps<"/atleta/sesion/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const view = await getSessionView(id, user.id, user.orgId);
  if (!view) notFound();
  return <SessionRunner view={view} />;
}
