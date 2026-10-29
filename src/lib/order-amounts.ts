/**
 * Importes de un pedido: cantidad, precio y subtotal de cada linea y monto
 * estimado (10.4c, hallazgo 6 de la 10.4a).
 *
 * La accion calculaba `cantidad * precio` y la suma en coma flotante, y la base
 * redondeaba cada columna por su cuenta: dos lineas de 1.25 x 10.25 guardaban
 * 12.81 + 12.81 y un monto de 25.63, mientras la proforma suma los subtotales
 * (25.62). Ahora la vista previa del formulario y las acciones de alta y
 * edicion usan esta funcion, y la accion guarda exactamente lo que devuelve.
 *
 * La regla es la de las columnas: `detalle_pedido.cantidad` es numeric(10,2) y
 * `precio_unitario`, `subtotal` y `pedido.monto_estimado`, numeric(12,2).
 * Postgres redondea el decimal que recibe a dos decimales, con la mitad lejos
 * del cero. El orden de las operaciones es parte del contrato:
 *
 * 1. la cantidad y el precio se redondean a dos decimales;
 * 2. el subtotal es el producto de los valores ya redondeados, redondeado;
 * 3. el monto es la suma de los subtotales ya redondeados.
 *
 * El calculo es entero (BigInt en centesimos) sobre el decimal que se escribio:
 * un numero de JavaScript se lee con String(n), el mismo texto que Prisma envia
 * a la base, asi que 2.675 redondea a 2.68 aunque (2.675).toFixed(2) de 2.67.
 * Funciones puras, sin Prisma ni `server-only`: las usa tambien el formulario.
 */

export type OrderAmountInput = {
  cantidad: number | string;
  precio_unitario: number | string;
};

/** Valores de una linea como se guardan: texto decimal con dos decimales. */
export type OrderLineAmounts = {
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
};

const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i;
const MAX_EXPONENT = 400;

/** Division entera que redondea la mitad lejos del cero, como numeric. */
function divideRounded(value: bigint, divisor: bigint) {
  const sign = value < 0n ? -1n : 1n;
  const magnitude = value * sign;

  return sign * ((magnitude + divisor / 2n) / divisor);
}

/**
 * Centesimos del decimal escrito, redondeados como numeric(_, 2). Un valor
 * que no es un numero da null; uno vacio (o solo un signo o una coma), cero.
 */
function toCents(value: number | string): bigint | null {
  const match = DECIMAL.exec(String(value).trim());

  if (!match) {
    return null;
  }

  const [, sign, integerDigits, fractionDigits = "", exponentText = "0"] = match;

  // Un numero finito de JavaScript no pasa de 1e308: un exponente mayor solo
  // llega en un texto armado y pediria una potencia enorme.
  if (Math.abs(Number(exponentText)) > MAX_EXPONENT) {
    return null;
  }

  const digits = BigInt(`${integerDigits}${fractionDigits}` || "0");
  // Posicion de la coma respecto de los centesimos.
  const shift = Number(exponentText) - fractionDigits.length + 2;
  const cents = shift >= 0 ? digits * 10n ** BigInt(shift) : divideRounded(digits, 10n ** BigInt(-shift));

  return sign === "-" ? -cents : cents;
}

function formatCents(cents: bigint) {
  const sign = cents < 0n ? "-" : "";
  const magnitude = cents < 0n ? -cents : cents;
  const text = magnitude.toString().padStart(3, "0");

  return `${sign}${text.slice(0, -2)}.${text.slice(-2)}`;
}

function lineCents({ cantidad, precio_unitario }: OrderAmountInput) {
  // En la vista previa un campo vacio cuenta como cero; la accion no llega
  // aqui con un valor invalido porque el esquema lo rechaza antes.
  const quantity = toCents(cantidad) ?? 0n;
  const unitPrice = toCents(precio_unitario) ?? 0n;
  // Centesimos x centesimos = diezmilesimos: se vuelve a centesimos redondeando.
  const subtotal = divideRounded(quantity * unitPrice, 100n);

  return { quantity, unitPrice, subtotal };
}

/** Cantidad, precio y subtotal de una linea, redondeados como sus columnas. */
export function calculateOrderLine(item: OrderAmountInput): OrderLineAmounts {
  const { quantity, unitPrice, subtotal } = lineCents(item);

  return {
    cantidad: formatCents(quantity),
    precio_unitario: formatCents(unitPrice),
    subtotal: formatCents(subtotal),
  };
}

/** Las lineas redondeadas y el monto estimado: la suma de sus subtotales. */
export function calculateOrderAmounts(items: OrderAmountInput[]) {
  const lines = items.map(calculateOrderLine);
  const total = items.reduce((sum, item) => sum + lineCents(item).subtotal, 0n);

  return { lines, total: formatCents(total) };
}
