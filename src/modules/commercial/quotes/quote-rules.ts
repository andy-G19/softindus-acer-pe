/**
 * Pedidos que admiten proforma (D29 de la 11.3a): los registrados o aprobados. La lista del
 * formulario solo ofrece esos y crear proforma lo vuelve a comprobar con el pedido bloqueado,
 * porque un formulario abierto antes de cancelar el pedido todavia lo envia.
 *
 * Vive fuera de actions.ts: ese modulo es "use server" y solo exporta acciones.
 */
export const QUOTABLE_ORDER_STATES = ["registrado", "aprobado"];

export const NOT_QUOTABLE_ORDER_MESSAGE =
  "Solo se puede generar la proforma de un pedido registrado o aprobado.";
