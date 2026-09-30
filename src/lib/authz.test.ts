import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

import {
  assertRole,
  getActiveUserSession,
  getAuthorizedSession,
  requireActiveUser,
  requireApiAuth,
  requireApiRole,
  requireAuth,
  requireRole,
  type ApiAuthResult,
} from "@/lib/authz";

// Pruebas de caracterizacion de los helpers de autorizacion.
//
// Fijan el contrato que las paginas, Server Actions y rutas API reciben de
// src/lib/authz.ts: a donde redirige cada helper, cuando devuelve null o una
// respuesta 401/403 y cuando registra el rechazo. auth() se reemplaza por un
// doble que devuelve la sesion ya revalidada, tal como la entrega src/auth.ts.

const mocks = vi.hoisted(() => {
  class RedirectSignal extends Error {
    constructor(readonly url: string) {
      super(`redirect: ${url}`);
    }
  }

  return {
    RedirectSignal,
    auth: vi.fn(),
    redirect: vi.fn(),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/logger", () => ({ logger: mocks.logger }));

const USER_ID = "USU00000001";
const EXPIRES = "2099-01-01T00:00:00.000Z";

function sessionOf(user: { id: string; role: string; status: string }): Session {
  return { user: { ...user, name: "Usuario de prueba" }, expires: EXPIRES };
}

function activeSession(role: string) {
  return sessionOf({ id: USER_ID, role, status: "activo" });
}

/** Lo que deja src/auth.ts cuando la revalidacion contra la base falla. */
const INVALIDATED_SESSION = sessionOf({ id: "", role: "", status: "inactivo" });

async function redirectTarget(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof mocks.RedirectSignal) {
      return error.url;
    }

    throw error;
  }

  throw new Error("Se esperaba una redireccion.");
}

async function rejectedResponse(result: ApiAuthResult) {
  if (result.ok) {
    throw new Error("Se esperaba un rechazo.");
  }

  return {
    status: result.response.status,
    body: await result.response.json(),
  };
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.redirect.mockImplementation((url: string) => {
    throw new mocks.RedirectSignal(url);
  });
  mocks.auth.mockResolvedValue(null);
});

describe("assertRole", () => {
  it("acepta un usuario activo con un rol permitido", () => {
    expect(assertRole(activeSession("SELLER"), ["ADMIN", "SELLER"])).toBe(true);
  });

  it("rechaza un usuario activo con un rol no permitido", () => {
    expect(assertRole(activeSession("SELLER"), ["ADMIN"])).toBe(false);
  });

  it("rechaza la ausencia de sesion", () => {
    expect(assertRole(null, ["ADMIN"])).toBe(false);
    expect(assertRole(undefined, ["ADMIN"])).toBe(false);
  });

  it("exige el estado activo de forma explicita, aunque el rol sea permitido", () => {
    const withoutId = sessionOf({ id: "", role: "ADMIN", status: "activo" });
    const inactive = sessionOf({ id: USER_ID, role: "ADMIN", status: "inactivo" });

    expect(assertRole(withoutId, ["ADMIN"])).toBe(false);
    expect(assertRole(inactive, ["ADMIN"])).toBe(false);
  });

  it("no consulta la sesion por su cuenta", () => {
    assertRole(activeSession("ADMIN"), ["ADMIN"]);

    expect(mocks.auth).not.toHaveBeenCalled();
  });
});

describe("getActiveUserSession", () => {
  it("devuelve la sesion de un usuario activo", async () => {
    const session = activeSession("WORKSHOP_MASTER");
    mocks.auth.mockResolvedValue(session);

    await expect(getActiveUserSession()).resolves.toBe(session);
  });

  it("devuelve null sin sesion o con la sesion invalidada, sin redirigir", async () => {
    await expect(getActiveUserSession()).resolves.toBeNull();

    mocks.auth.mockResolvedValue(INVALIDATED_SESSION);
    await expect(getActiveUserSession()).resolves.toBeNull();

    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("getAuthorizedSession", () => {
  it("devuelve la sesion si el rol esta permitido", async () => {
    const session = activeSession("ADMIN");
    mocks.auth.mockResolvedValue(session);

    await expect(getAuthorizedSession(["ADMIN", "SELLER"])).resolves.toBe(session);
    expect(mocks.logger.warn).not.toHaveBeenCalled();
  });

  it("devuelve null sin sesion y no registra advertencia", async () => {
    await expect(getAuthorizedSession(["ADMIN"])).resolves.toBeNull();

    expect(mocks.logger.warn).not.toHaveBeenCalled();
  });

  it("devuelve null con la sesion invalidada y no registra advertencia", async () => {
    mocks.auth.mockResolvedValue(INVALIDATED_SESSION);

    await expect(getAuthorizedSession(["ADMIN"])).resolves.toBeNull();
    expect(mocks.logger.warn).not.toHaveBeenCalled();
  });

  it("devuelve null y registra el intento si el rol no esta permitido", async () => {
    mocks.auth.mockResolvedValue(activeSession("SELLER"));

    await expect(getAuthorizedSession(["ADMIN"])).resolves.toBeNull();
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      "Intento de Server Action sin rol autorizado.",
      { userId: USER_ID, role: "SELLER", allowedRoles: ["ADMIN"] },
    );
  });

  it("nunca redirige", async () => {
    mocks.auth.mockResolvedValue(activeSession("SELLER"));
    await getAuthorizedSession(["ADMIN"]);

    mocks.auth.mockResolvedValue(null);
    await getAuthorizedSession(["ADMIN"]);

    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("requireAuth", () => {
  it("redirige a /login sin sesion", async () => {
    await expect(redirectTarget(() => requireAuth())).resolves.toBe("/login");
  });

  it("redirige a /login con el motivo si la sesion quedo invalidada", async () => {
    mocks.auth.mockResolvedValue(INVALIDATED_SESSION);

    await expect(redirectTarget(() => requireAuth())).resolves.toBe(
      "/login?reason=session-invalid",
    );
  });

  it("devuelve la sesion de un usuario activo, sin mirar el rol", async () => {
    const session = activeSession("SELLER");
    mocks.auth.mockResolvedValue(session);

    await expect(requireAuth()).resolves.toBe(session);
  });

  it("requireActiveUser es el mismo helper", () => {
    expect(requireActiveUser).toBe(requireAuth);
  });
});

describe("requireRole", () => {
  it("redirige a /login sin sesion", async () => {
    await expect(redirectTarget(() => requireRole(["ADMIN"]))).resolves.toBe(
      "/login",
    );
  });

  it("redirige a /login con el motivo si la sesion quedo invalidada", async () => {
    mocks.auth.mockResolvedValue(INVALIDATED_SESSION);

    await expect(redirectTarget(() => requireRole(["ADMIN"]))).resolves.toBe(
      "/login?reason=session-invalid",
    );
    expect(mocks.logger.warn).not.toHaveBeenCalled();
  });

  it("redirige a acceso denegado y registra el intento si el rol no esta permitido", async () => {
    mocks.auth.mockResolvedValue(activeSession("WORKSHOP_MASTER"));

    await expect(redirectTarget(() => requireRole(["ADMIN"]))).resolves.toBe(
      "/dashboard/access-denied",
    );
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      "Acceso denegado por rol en pagina/Server Action.",
      { userId: USER_ID, role: "WORKSHOP_MASTER", allowedRoles: ["ADMIN"] },
    );
  });

  it("devuelve la sesion si el rol es cualquiera de los permitidos", async () => {
    const session = activeSession("WORKSHOP_MASTER");
    mocks.auth.mockResolvedValue(session);

    await expect(requireRole(["ADMIN", "WORKSHOP_MASTER"])).resolves.toBe(
      session,
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.logger.warn).not.toHaveBeenCalled();
  });

  it("consulta la sesion una sola vez", async () => {
    mocks.auth.mockResolvedValue(activeSession("ADMIN"));

    await requireRole(["ADMIN"]);

    expect(mocks.auth).toHaveBeenCalledTimes(1);
  });
});

describe("requireApiAuth", () => {
  it("responde 401 sin sesion", async () => {
    await expect(rejectedResponse(await requireApiAuth())).resolves.toEqual({
      status: 401,
      body: { error: "No autorizado." },
    });
  });

  it("responde 401 con la sesion invalidada", async () => {
    mocks.auth.mockResolvedValue(INVALIDATED_SESSION);

    await expect(rejectedResponse(await requireApiAuth())).resolves.toEqual({
      status: 401,
      body: { error: "No autorizado." },
    });
  });

  it("devuelve la sesion de un usuario activo", async () => {
    const session = activeSession("SELLER");
    mocks.auth.mockResolvedValue(session);

    await expect(requireApiAuth()).resolves.toEqual({ ok: true, session });
  });
});

describe("requireApiRole", () => {
  it("responde 401 sin sesion, antes de mirar el rol", async () => {
    await expect(rejectedResponse(await requireApiRole(["ADMIN"]))).resolves.toEqual({
      status: 401,
      body: { error: "No autorizado." },
    });
  });

  it("responde 403 con un rol no permitido", async () => {
    mocks.auth.mockResolvedValue(activeSession("SELLER"));

    await expect(rejectedResponse(await requireApiRole(["ADMIN"]))).resolves.toEqual({
      status: 403,
      body: { error: "No tiene permisos suficientes para realizar esta acción." },
    });
  });

  it("devuelve la sesion si el rol esta permitido", async () => {
    const session = activeSession("ADMIN");
    mocks.auth.mockResolvedValue(session);

    await expect(requireApiRole(["ADMIN"])).resolves.toEqual({ ok: true, session });
  });

  it("nunca redirige", async () => {
    await requireApiRole(["ADMIN"]);

    mocks.auth.mockResolvedValue(activeSession("SELLER"));
    await requireApiRole(["ADMIN"]);

    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
