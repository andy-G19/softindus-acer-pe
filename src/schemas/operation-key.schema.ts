import { z } from "zod";

/**
 * Clave de idempotencia que envia un formulario (OperationKeyField, 11.2a). La reclama la
 * accion con claimOperation (src/lib/idempotency.ts). Va en un campo oculto: su mensaje es el
 * error general del formulario, no el de un campo.
 */
export const OPERATION_KEY_ERROR = "No se pudo identificar el envío. Recarga la página e inténtalo de nuevo.";

export const operationKeySchema = z.uuid({ error: OPERATION_KEY_ERROR });
