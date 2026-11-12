/**
 * Una sola regla para saber si un pedido se puede editar o cancelar (C3 de la 11.3b, D30). La
 * usan el listado (que ofrece «Editar» y «Cancelar»), la pagina de edicion y las acciones de
 * editar y cancelar, asi que lo que la pantalla ofrece es lo que la accion acepta.
 *
 * Bloquean un pedido cancelado o anulado, una proforma activa (vigente, aceptada o pagada), un
 * comprobante emitido y una orden de trabajo. Una proforma o un comprobante anulados no bloquean:
 * anular la proforma deja el pedido listo para otra (getQuotableOrders) y tambien para editarlo
 * o cancelarlo.
 *
 * Funciones puras, sin Prisma ni `server-only`: las usan paginas y acciones.
 */

export const ACTIVE_QUOTE_STATES = ["vigente", "aceptada", "pagada"];

export const CLOSED_ORDER_MESSAGE = "No se puede modificar un pedido cancelado.";
export const LINKED_ORDER_MESSAGE = "No se puede modificar un pedido con proforma, comprobante u orden asociada.";

export type OrderChangeSubject = {
  estado: string;
  proforma: { estado: string }[];
  comprobante_venta: { estado: string }[];
  detalle_pedido: { orden_trabajo: unknown[] }[];
};

/** El motivo por el que el pedido no se puede cambiar, o null si se puede. */
export function getOrderChangeBlock(order: OrderChangeSubject): string | null {
  if (order.estado === "cancelado" || order.estado === "anulado") {
    return CLOSED_ORDER_MESSAGE;
  }

  const hasActiveQuote = order.proforma.some((quote) => ACTIVE_QUOTE_STATES.includes(quote.estado));
  const hasIssuedReceipt = order.comprobante_venta.some((receipt) => receipt.estado === "emitido");
  const hasWorkOrders = order.detalle_pedido.some((detail) => detail.orden_trabajo.length > 0);

  if (hasActiveQuote || hasIssuedReceipt || hasWorkOrders) {
    return LINKED_ORDER_MESSAGE;
  }

  return null;
}

export function canChangeOrder(order: OrderChangeSubject) {
  return getOrderChangeBlock(order) === null;
}
