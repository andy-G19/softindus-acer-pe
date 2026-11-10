import { divideRounded, formatCents, multiplyCents, toCents } from "@/lib/decimal-cents";
import { IGV_PERCENT } from "@/lib/taxes";

/**
 * Importes de una compra: cantidad, costo y subtotal de cada linea, subtotal, IGV y total
 * (11.2b, hallazgos 1 a 3 y 6).
 *
 * La accion calculaba en coma flotante sobre la cantidad sin redondear y cada columna
 * redondeaba por su cuenta: dos lineas de 1.25 x 10.25 guardaban 12.81 + 12.81 pero un
 * subtotal de 25.63, con un total que no era subtotal + IGV; 1.005 x 10 guardaba la cantidad
 * 1.01 con un subtotal de 10.05. Ahora la accion y la vista previa del formulario usan esta
 * funcion, y la accion guarda exactamente lo que devuelve.
 *
 * La regla es la de las columnas: `detalle_compra.cantidad` es numeric(10,2) y
 * `costo_unitario`, `subtotal`, `compra.subtotal`, `igv` y `monto_total`, numeric(12,2). El
 * orden de las operaciones es parte del contrato, el mismo que pedidos (order-amounts.ts):
 *
 * 1. la cantidad y el costo se redondean a dos decimales;
 * 2. el subtotal de la linea es el producto de los valores ya redondeados, redondeado;
 * 3. el subtotal de la compra es la suma de los subtotales ya redondeados;
 * 4. el IGV es el porcentaje del subtotal, redondeado; el total es subtotal + IGV.
 *
 * Funciones puras, sin Prisma ni `server-only`: las usa tambien el formulario.
 */

export type PurchaseAmountItem = {
  cantidad: number | string;
  costo_unitario: number | string;
};

/** Valores de una linea como se guardan: texto decimal con dos decimales. */
export type PurchaseLineAmounts = {
  cantidad: string;
  costo_unitario: string;
  subtotal: string;
};

function lineCents({ cantidad, costo_unitario }: PurchaseAmountItem) {
  // En la vista previa un campo vacio cuenta como cero; la accion no llega aqui con un
  // valor invalido porque el esquema lo rechaza antes.
  const quantity = toCents(cantidad) ?? 0n;
  const unitCost = toCents(costo_unitario) ?? 0n;

  return { quantity, unitCost, subtotal: multiplyCents(quantity, unitCost) };
}

/** Las lineas redondeadas, el subtotal, el IGV (si aplica) y el total. */
export function calculatePurchaseAmounts({
  items,
  aplicaIgv,
}: {
  items: PurchaseAmountItem[];
  aplicaIgv: boolean;
}) {
  const computed = items.map(lineCents);
  const subtotal = computed.reduce((sum, line) => sum + line.subtotal, 0n);
  const igv = aplicaIgv ? divideRounded(subtotal * BigInt(IGV_PERCENT), 100n) : 0n;

  return {
    lines: computed.map(
      ({ quantity, unitCost, subtotal: lineSubtotal }): PurchaseLineAmounts => ({
        cantidad: formatCents(quantity),
        costo_unitario: formatCents(unitCost),
        subtotal: formatCents(lineSubtotal),
      }),
    ),
    subtotal: formatCents(subtotal),
    igv: formatCents(igv),
    total: formatCents(subtotal + igv),
  };
}
