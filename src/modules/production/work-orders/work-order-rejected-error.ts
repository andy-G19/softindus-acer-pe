import type { FieldErrors } from "@/lib/errors";

/**
 * Un rechazo de una operacion de ordenes de trabajo, decidido dentro de su transaccion (C5 de la
 * 11.6a, compartido desde C1 de la 11.6b).
 *
 * Se lanza para que la transaccion se revierta y, con ella, el reclamo de la clave de operacion:
 * el envio corregido con la misma clave vuelve a intentarlo. La accion lo convierte en el error de
 * su campo, o en el mensaje general cuando no lo causa un campo del formulario (la orden anulada,
 * los materiales ya cerrados).
 */
export class WorkOrderRejectedError extends Error {
  constructor(
    readonly field: string | null,
    message: string,
  ) {
    super(message);
  }

  /** El error de su campo, o nada si es un mensaje general. */
  get fieldErrors(): FieldErrors | undefined {
    return this.field ? { [this.field]: [this.message] } : undefined;
  }
}
