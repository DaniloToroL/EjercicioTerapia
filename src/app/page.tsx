import { redirect } from "next/navigation";
import { getCurrentUser, isCoach } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    const anyUser = await prisma.user.count();
    redirect(anyUser === 0 ? "/setup" : "/login");
  }
  redirect(isCoach(user) ? "/coach" : "/atleta");
}
