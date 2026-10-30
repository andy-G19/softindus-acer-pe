import { formatCents, multiplyCents, toCents } from "@/lib/decimal-cents";

/**
 * Importes de una reparacion: cantidad, costo y subtotal de cada repuesto, mano
 * de obra y costo total (10.5b, hallazgo 3 de la auditoria de la 10.5).
 *
 * La accion calculaba en coma flotante y la base redondeaba cada columna por su
 * cuenta: dos repuestos de 1.25 x 10.25 guardaban 12.81 + 12.81 y un total de
 * 25.63, y una cantidad de 1.005 se guardaba 1.01 con el subtotal de 1.005.
 * Ahora la accion guarda exactamente lo que devuelve esta funcion.
 *
 * La regla es la de las columnas: `detalle_repuesto_reparacion.cantidad` es
 * numeric(10,2) y `costo_unitario`, `subtotal`, `reparacion.mano_obra` y
 * `costo_total`, numeric(12,2). El orden de las operaciones es parte del
 * contrato:
 *
 * 1. la cantidad, el costo y la mano de obra se redondean a dos decimales;
 * 2. el subtotal es el producto de los valores ya redondeados, redondeado;
 * 3. el total es la mano de obra mas la suma de los subtotales ya redondeados.
 */

export type RepairAmountItem = {
  cantidad: number | string;
  costo_unitario: number | string;
};

export type RepairAmountInput = {
  mano_obra: number | string | null | undefined;
  items: RepairAmountItem[];
};

/** Valores de un repuesto como se guardan: texto decimal con dos decimales. */
export type RepairLineAmounts = {
  cantidad: string;
  costo_unitario: string;
  subtotal: string;
};

function lineCents({ cantidad, costo_unitario }: RepairAmountItem) {
  // En la vista previa un campo vacio cuenta como cero; la accion no llega
  // aqui con un valor invalido porque el esquema lo rechaza antes.
  const quantity = toCents(cantidad) ?? 0n;
  const unitCost = toCents(costo_unitario) ?? 0n;

  return { quantity, unitCost, subtotal: multiplyCents(quantity, unitCost) };
}

/** Sin mano de obra la columna queda vacia y el total cuenta cero. */
function laborCents(value: RepairAmountInput["mano_obra"]) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return toCents(value) ?? 0n;
}

/** Los repuestos redondeados, la mano de obra y el costo total. */
export function calculateRepairAmounts({ mano_obra, items }: RepairAmountInput) {
  const computed = items.map(lineCents);
  const sparePartsTotal = computed.reduce((sum, line) => sum + line.subtotal, 0n);
  const labor = laborCents(mano_obra);

  return {
    lines: computed.map(
      ({ quantity, unitCost, subtotal }): RepairLineAmounts => ({
        cantidad: formatCents(quantity),
        costo_unitario: formatCents(unitCost),
        subtotal: formatCents(subtotal),
      }),
    ),
    mano_obra: labor === null ? null : formatCents(labor),
    sparePartsTotal: formatCents(sparePartsTotal),
    total: formatCents((labor ?? 0n) + sparePartsTotal),
  };
}
