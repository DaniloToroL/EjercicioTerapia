import "server-only";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// Límite simple de intentos fallidos por email (en memoria: un solo servidor).
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const failedAttempts = new Map<string, { count: number; first: number }>();

function isLocked(email: string) {
  const entry = failedAttempts.get(email);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failedAttempts.delete(email);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function registerFailure(email: string) {
  const entry = failedAttempts.get(email);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failedAttempts.set(email, { count: 1, first: Date.now() });
  else entry.count++;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email y contraseña",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;
        if (isLocked(email)) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        const ok = !!user?.active && !!user.passwordHash && (await bcrypt.compare(password, user.passwordHash));
        if (!ok || !user) {
          registerFailure(email);
          return null;
        }
        failedAttempts.delete(email);
        return { id: user.id, name: user.name, email: user.email, role: user.role, orgId: user.orgId };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.orgId = user.orgId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.orgId = token.orgId;
      return session;
    },
  },
};

export type SessionUser = { id: string; name: string; email: string; role: Role; orgId: string };

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  // Se valida contra la base para reflejar desactivaciones o cambios de rol.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, orgId: true, active: true },
  });
  if (!user || !user.active) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, orgId: user.orgId };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function isCoach(user: Pick<SessionUser, "role">) {
  return user.role === "OWNER" || user.role === "COACH";
}

export async function requireCoach() {
  const user = await requireUser();
  if (!isCoach(user)) redirect("/atleta");
  return user;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}
