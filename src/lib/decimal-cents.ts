/**
 * Nucleo de los importes que deben coincidir con lo que guarda la base: los
 * de pedidos (order-amounts.ts) y reparaciones (repair-amounts.ts).
 *
 * Postgres redondea el decimal que recibe a dos decimales, con la mitad lejos
 * del cero. El calculo es entero (BigInt en centesimos) sobre el decimal que se
 * escribio: un numero de JavaScript se lee con String(n), el mismo texto que
 * Prisma envia a la base, asi que 2.675 redondea a 2.68 aunque
 * (2.675).toFixed(2) de 2.67.
 * Funciones puras, sin Prisma ni `server-only`: las usan tambien los formularios.
 */

const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i;
const MAX_EXPONENT = 400;

/** Division entera que redondea la mitad lejos del cero, como numeric. */
export function divideRounded(value: bigint, divisor: bigint) {
  const sign = value < 0n ? -1n : 1n;
  const magnitude = value * sign;

  return sign * ((magnitude + divisor / 2n) / divisor);
}

/**
 * Centesimos del decimal escrito, redondeados como numeric(_, 2). Un valor
 * que no es un numero da null; uno vacio (o solo un signo o una coma), cero.
 */
export function toCents(value: number | string): bigint | null {
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

/** Centesimos x centesimos = diezmilesimos: vuelve a centesimos redondeando. */
export function multiplyCents(left: bigint, right: bigint) {
  return divideRounded(left * right, 100n);
}

export function formatCents(cents: bigint) {
  const sign = cents < 0n ? "-" : "";
  const magnitude = cents < 0n ? -cents : cents;
  const text = magnitude.toString().padStart(3, "0");

  return `${sign}${text.slice(0, -2)}.${text.slice(-2)}`;
}
