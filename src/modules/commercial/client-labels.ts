import { getOptionLabel, type OptionList } from "@/modules/commercial/payment-labels";

/**
 * Textos del tipo de cliente y del tipo de documento de Comercial (C2 del grupo de fixes, D124 y
 * D125). La columna guarda el valor (`cliente_final`, `ruc`) y la pantalla muestra su texto: el
 * formulario de cliente, la tabla, el filtro y el buscador de clientes, el detalle de proforma, el
 * formulario de pedido y el reporte de ventas y cobranzas leen estas listas, como las de pago
 * (`payment-labels.ts`). Un valor que la lista no conoce se muestra tal cual (`getOptionLabel`).
 *
 * Modulo puro, sin Prisma ni `server-only`: lo usan paginas y componentes.
 */

/** Pares `[valor guardado, texto]`, en el orden en que los ofrece el formulario de cliente. */
export const CLIENT_TYPE_OPTIONS = [
  ["cliente_final", "Cliente final"],
  ["ferreteria", "Ferretería"],
  ["distribuidora", "Distribuidora"],
  ["constructora", "Constructora"],
  ["otro", "Otro"],
] as const satisfies OptionList;

/** Los tipos de documento que acepta el esquema; «Sin documento» es el valor vacio del formulario. */
export const DOCUMENT_TYPE_OPTIONS = [
  ["dni", "DNI"],
  ["ruc", "RUC"],
  ["otro", "Otro"],
] as const satisfies OptionList;

export function getClientTypeLabel(value: string) {
  return getOptionLabel(CLIENT_TYPE_OPTIONS, value);
}

export function getDocumentTypeLabel(value: string) {
  return getOptionLabel(DOCUMENT_TYPE_OPTIONS, value);
}

/**
 * Las opciones del filtro de tipo de cliente: la lista entera, en su orden, y despues cada tipo
 * guardado que la lista no conoce, tal cual, para que se pueda seguir filtrando por el.
 */
export function getClientTypeFilterOptions(storedTypes: readonly string[]) {
  const known = new Set<string>(CLIENT_TYPE_OPTIONS.map(([value]) => value));
  const unknown = Array.from(new Set(storedTypes.filter((type) => type && !known.has(type)))).sort();

  return [
    ...CLIENT_TYPE_OPTIONS.map(([value, label]) => ({ value, label })),
    ...unknown.map((value) => ({ value, label: value })),
  ];
}
