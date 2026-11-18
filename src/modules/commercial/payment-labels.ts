/**
 * Textos de los valores de pago y comprobante de Comercial (C1 de la 11.3c, D36). Las columnas
 * guardan el valor (`amortizacion`, `efectivo`, `boleta`) y la pantalla muestra su texto: los
 * filtros, las tablas de los listados y los historiales del detalle de proforma leen las mismas
 * listas, asi que lo que se filtra es lo que se ve.
 *
 * Los formularios de Comercial (pago de cliente, adelanto de la proforma y comprobante) usan las
 * mismas listas desde la 11.7d (C6, D106). El pago ofrece el tipo en este orden; su valor por
 * defecto, «Amortización», va explicito en el formulario, asi que el orden no cambia lo que envia.
 *
 * Modulo puro, sin Prisma ni `server-only`: lo usan paginas y componentes.
 */

/** Pares `[valor guardado, texto]`, en el orden en que los ofrecen los filtros. */
export type OptionList = readonly (readonly [value: string, label: string])[];

export const PAYMENT_METHOD_OPTIONS = [
  ["efectivo", "Efectivo"],
  ["transferencia", "Transferencia"],
  ["yape", "Yape"],
  ["plin", "Plin"],
  ["otro", "Otro"],
] as const satisfies OptionList;

export const PAYMENT_TYPE_OPTIONS = [
  ["adelanto", "Adelanto"],
  ["amortizacion", "Amortización"],
  ["cancelacion", "Cancelación"],
] as const satisfies OptionList;

export const RECEIPT_TYPE_OPTIONS = [
  ["boleta", "Boleta"],
  ["factura", "Factura"],
  ["recibo", "Recibo"],
  ["otro", "Otro"],
] as const satisfies OptionList;

/**
 * El texto de un valor guardado. Un valor que la lista no conoce (un dato antiguo en una columna
 * `varchar`) se muestra tal cual, como `getUserStatusLabel`: nunca una celda vacia.
 */
export function getOptionLabel(options: OptionList, value: string) {
  return options.find(([optionValue]) => optionValue === value)?.[1] ?? value;
}
