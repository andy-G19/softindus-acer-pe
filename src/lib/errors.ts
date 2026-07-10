import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "DATABASE_ERROR"
  | "INTERNAL_ERROR";

type AppErrorOptions = {
  code?: AppErrorCode;
  statusCode?: number;
  // Un error "operacional" es uno esperado dentro del dominio (validacion,
  // recurso inexistente, conflicto de negocio, rate limit): su mensaje es
  // seguro para mostrar tal cual al usuario. Uno no operacional (bug, fallo
  // de infraestructura) nunca expone su mensaje real al cliente.
  isOperational?: boolean;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly statusCode: number;
  readonly isOperational: boolean;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);

    this.name = "AppError";
    this.code = options.code ?? "INTERNAL_ERROR";
    this.statusCode = options.statusCode ?? 500;
    this.isOperational = options.isOperational ?? true;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Los datos ingresados no son válidos.", cause?: unknown) {
    super(message, { code: "VALIDATION_ERROR", statusCode: 400, isOperational: true, cause });
    this.name = "ValidationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "No tiene autorización para realizar esta acción.", cause?: unknown) {
    super(message, { code: "UNAUTHORIZED", statusCode: 401, isOperational: true, cause });
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "El recurso solicitado no existe.", cause?: unknown) {
    super(message, { code: "NOT_FOUND", statusCode: 404, isOperational: true, cause });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(
    message = "La operación no se puede completar por el estado actual del registro.",
    cause?: unknown,
  ) {
    super(message, { code: "CONFLICT", statusCode: 409, isOperational: true, cause });
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(
    message = "Demasiados intentos. Intente nuevamente más tarde.",
    cause?: unknown,
  ) {
    super(message, { code: "RATE_LIMITED", statusCode: 429, isOperational: true, cause });
    this.name = "RateLimitError";
  }
}

export class DatabaseError extends AppError {
  constructor(
    message = "Ocurrió un error al acceder a los datos.",
    cause?: unknown,
  ) {
    // No operacional: un fallo de base de datos es un problema interno, no
    // un mensaje seguro para mostrar tal cual al usuario final.
    super(message, { code: "DATABASE_ERROR", statusCode: 500, isOperational: false, cause });
    this.name = "DatabaseError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

const GENERIC_ERROR_MESSAGE = "Ocurrió un error inesperado. Intente nuevamente.";

/**
 * Mensaje seguro para mostrar al usuario. Los AppError operacionales
 * exponen su propio mensaje (ya redactado para ser visible); cualquier otro
 * error (bug, fallo de infraestructura, excepcion no controlada) cae al
 * mensaje generico para no filtrar detalles internos.
 */
export function getErrorMessage(error: unknown): string {
  if (isAppError(error) && error.isOperational) {
    return error.message;
  }

  return GENERIC_ERROR_MESSAGE;
}

function logCaughtError(error: unknown, context?: Record<string, unknown>) {
  if (isAppError(error) && error.isOperational) {
    logger.warn(error.message, { code: error.code, ...context });
    return;
  }

  logger.error("Error no controlado.", { error, ...context });
}

export type ActionErrorState = {
  error: string;
};

/**
 * Convierte cualquier error capturado en un estado seguro para un
 * useActionState/Server Action, registrando el detalle real en el logger.
 */
export function toActionError(
  error: unknown,
  context?: Record<string, unknown>,
): ActionErrorState {
  logCaughtError(error, context);

  return { error: getErrorMessage(error) };
}

/**
 * Convierte cualquier error capturado en una respuesta JSON segura para una
 * ruta API, registrando el detalle real en el logger y preservando el
 * status code cuando el error es un AppError conocido.
 */
export function toApiErrorResponse(
  error: unknown,
  context?: Record<string, unknown>,
): NextResponse {
  logCaughtError(error, context);

  const statusCode = isAppError(error) ? error.statusCode : 500;

  return NextResponse.json({ error: getErrorMessage(error) }, { status: statusCode });
}
