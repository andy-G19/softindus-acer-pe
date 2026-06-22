import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { AppRole } from "@/lib/permissions";

export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

export async function requireRole(allowedRoles: AppRole[]) {
  const session = await requireAuth();

  if (!allowedRoles.includes(session.user.role as AppRole)) {
    redirect("/dashboard/access-denied");
  }

  return session;
}