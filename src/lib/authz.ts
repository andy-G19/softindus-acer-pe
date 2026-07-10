import "server-only";

import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import type { NextResponse } from "next/server";

import { auth } from "@/auth";
import { ForbiddenError, AuthorizationError, toApiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { type AppRole } from "@/lib/permissions";

const ACTIVE_STATUS = "activo";

// Alias mas corto y semantico de AppRole (src/lib/permissions.ts), que ya es
// la fuente de verdad de los roles del sistema. No se duplica el union type.
export type Role = AppRole;

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
 * Chequeo puro: sesion activa (Bloque 3) + rol permitido. No llama a auth()
 * ni redirige; solo evalua lo que ya se tiene en mano.
 */
export function assertRole(
  session: Session | null | undefined,
  allowedRoles: Role[],
): session is Session {
  return (
    isActiveSessionUser(session?.user) &&
    allowedRoles.includes(session.user.role as Role)
  );
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

/**
 * Igual que getActiveUserSession, pero ademas exige que el rol este dentro
 * de allowedRoles. No redirige: pensado para Server Actions que necesitan
 * devolver un estado de formulario (useActionState) en vez de navegar fuera
 * de la pagina cuando el usuario no tiene permiso.
 */
export async function getAuthorizedSession(allowedRoles: Role[]) {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role;

  if (!assertRole(session, allowedRoles)) {
    if (userId) {
      logger.warn("Intento de Server Action sin rol autorizado.", {
        userId,
        role,
        allowedRoles,
      });
    }

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

export async function requireRole(allowedRoles: Role[]) {
  const session = await requireAuth();

  if (!allowedRoles.includes(session.user.role as Role)) {
    logger.warn("Acceso denegado por rol en pagina/Server Action.", {
      userId: session.user.id,
      role: session.user.role,
      allowedRoles,
    });

    redirect("/dashboard/access-denied");
  }

  return session;
}

export type ApiAuthResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

/**
 * Variante para rutas API: nunca redirige (no tiene sentido en una API),
 * devuelve un resultado discriminado para que el route handler decida que
 * responder. Sesion invalida/inexistente => 401 con mensaje seguro.
 */
export async function requireApiAuth(): Promise<ApiAuthResult> {
  const session = await auth();

  if (!isActiveSessionUser(session?.user)) {
    return {
      ok: false,
      response: toApiErrorResponse(new AuthorizationError("No autorizado.")),
    };
  }

  return { ok: true, session };
}

/**
 * Como requireApiAuth, pero ademas exige un rol permitido. Sin sesion
 * valida => 401; con sesion pero rol no permitido => 403. Ambos casos usan
 * errores operacionales de src/lib/errors.ts (mensaje seguro + logging).
 */
export async function requireApiRole(
  allowedRoles: Role[],
): Promise<ApiAuthResult> {
  const authResult = await requireApiAuth();

  if (!authResult.ok) {
    return authResult;
  }

  if (!allowedRoles.includes(authResult.session.user.role as Role)) {
    return {
      ok: false,
      response: toApiErrorResponse(new ForbiddenError(), {
        userId: authResult.session.user.id,
        role: authResult.session.user.role,
        allowedRoles,
      }),
    };
  }

  return authResult;
}
