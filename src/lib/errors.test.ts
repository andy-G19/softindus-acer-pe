import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AppError,
  AuthorizationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  getErrorMessage,
  isAppError,
  toActionError,
  toApiErrorResponse,
} from "@/lib/errors";

describe("AppError", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("conserva code, statusCode, message e isOperational", () => {
    const error = new AppError("Mensaje de prueba.", {
      code: "VALIDATION_ERROR",
      statusCode: 400,
      isOperational: true,
    });

    expect(error.message).toBe("Mensaje de prueba.");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
    expect(error).toBeInstanceOf(Error);
  });

  it("usa valores por defecto seguros cuando no se especifican opciones", () => {
    const error = new AppError("Fallo interno.");

    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
  });
});

describe("isAppError", () => {
  it("detecta instancias de AppError y sus subclases", () => {
    expect(isAppError(new AppError("x"))).toBe(true);
    expect(isAppError(new NotFoundError())).toBe(true);
    expect(isAppError(new Error("no es AppError"))).toBe(false);
    expect(isAppError("string cualquiera")).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe("statusCode de subclases conocidas", () => {
  it("AuthorizationError usa 401", () => {
    expect(new AuthorizationError().statusCode).toBe(401);
  });

  it("ForbiddenError usa 403", () => {
    expect(new ForbiddenError().statusCode).toBe(403);
  });

  it("NotFoundError usa 404", () => {
    expect(new NotFoundError().statusCode).toBe(404);
  });

  it("ConflictError usa 409", () => {
    expect(new ConflictError().statusCode).toBe(409);
  });

  it("RateLimitError usa 429", () => {
    expect(new RateLimitError().statusCode).toBe(429);
  });
});

describe("getErrorMessage", () => {
  it("devuelve el mensaje real de un AppError operacional", () => {
    const error = new NotFoundError("El cliente no existe.");

    expect(getErrorMessage(error)).toBe("El cliente no existe.");
  });

  it("devuelve un mensaje generico para errores no operacionales", () => {
    const error = new AppError("Detalle interno sensible.", {
      isOperational: false,
    });

    expect(getErrorMessage(error)).toBe(
      "Ocurrió un error inesperado. Intente nuevamente.",
    );
  });

  it("devuelve un mensaje generico para errores desconocidos (no AppError)", () => {
    expect(getErrorMessage(new Error("Fallo de base de datos: password=abc"))).toBe(
      "Ocurrió un error inesperado. Intente nuevamente.",
    );
    expect(getErrorMessage("cualquier cosa")).toBe(
      "Ocurrió un error inesperado. Intente nuevamente.",
    );
  });
});

describe("toActionError", () => {
  it("devuelve un estado seguro con el mensaje operacional", () => {
    const state = toActionError(new ConflictError("Ya existe un registro igual."));

    expect(state).toEqual({ error: "Ya existe un registro igual." });
  });

  it("no filtra el mensaje real de un error no operacional", () => {
    const state = toActionError(new Error("stack trace interno"));

    expect(state.error).toBe("Ocurrió un error inesperado. Intente nuevamente.");
  });
});

describe("toApiErrorResponse", () => {
  it("preserva el status code de un AppError conocido", async () => {
    const response = toApiErrorResponse(new ForbiddenError());

    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body).toEqual({
      error: "No tiene permisos suficientes para realizar esta acción.",
    });
  });

  it("usa 500 para errores no controlados", async () => {
    const response = toApiErrorResponse(new Error("fallo inesperado de infraestructura"));

    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe("Ocurrió un error inesperado. Intente nuevamente.");
  });

  it("nunca expone detalles del error real al cliente en produccion", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = toApiErrorResponse(
      new Error("DATABASE_URL=postgres://user:pass@host/db"),
    );
    const body = await response.json();
    const rawBody = JSON.stringify(body);

    expect(rawBody).not.toContain("DATABASE_URL");
    expect(rawBody).not.toContain("postgres://");
    expect(rawBody).not.toContain("stack");
  });
});
