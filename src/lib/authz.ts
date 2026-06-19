import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { UserRole } from "@/generated/prisma/client";

export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

export async function requireRole(allowedRoles: UserRole[]) {
  const session = await requireAuth();

  if (!allowedRoles.includes(session.user.role as UserRole)) {
    redirect("/dashboard/access-denied");
  }

  return session;
}