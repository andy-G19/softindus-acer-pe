import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { AppRole } from "@/lib/permissions";

const ACTIVE_STATUS = "activo";

type SessionUser = {
  id: string;
  role: string;
  status: string;
};

// La sesion solo es valida si auth.ts logro revalidarla contra la base de
// datos en esta misma peticion: id no vacio y estado = "activo". Un usuario
// desactivado, eliminado o con error de revalidacion llega aqui con
// id/role vacios (ver callbacks jwt/session en src/auth.ts).
function isActiveSessionUser(
  user: Partial<SessionUser> | null | undefined,
): user is SessionUser {
  return Boolean(user?.id) && user?.status === ACTIVE_STATUS;
}

/**
 * Devuelve la sesion solo si el usuario esta activo. No redirige: pensado
 * para contextos donde la ausencia de sesion valida es un caso normal
 * (por ejemplo, la propia pagina de login).
 */
export async function getActiveUserSession() {
  const session = await auth();

  if (!isActiveSessionUser(session?.user)) {
    return null;
  }

  return session;
}

export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!isActiveSessionUser(session.user)) {
    redirect("/login?reason=session-invalid");
  }

  return session;
}

// Alias semantico: en este proyecto una sesion "autenticada" ya implica
// usuario activo revalidado contra base de datos.
export const requireActiveUser = requireAuth;

export async function requireRole(allowedRoles: AppRole[]) {
  const session = await requireAuth();

  if (!allowedRoles.includes(session.user.role as AppRole)) {
    redirect("/dashboard/access-denied");
  }

  return session;
}