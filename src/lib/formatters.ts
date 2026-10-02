import type { NumericInput } from "@/lib/numbers";

type MoneyOptions = {
  /** Texto cuando falta el monto; lo decide cada pantalla ("-", "Sin precio"). */
  emptyText: string;
};

/**
 * Monto en soles con dos decimales y sin separador de miles: "S/ 1234.50".
 *
 * Sin opciones solo acepta un monto presente. Si puede faltar, TypeScript obliga a
 * decidir qué mostrar: `formatMoney(x ?? 0)` cuando falta significa cero, o
 * `formatMoney(x, { emptyText })`. Un valor no numérico se muestra como "-".
 */
export function formatMoney(value: NonNullable<NumericInput>): string;
export function formatMoney(value: unknown, options: MoneyOptions): string;
export function formatMoney(value: unknown, options?: MoneyOptions) {
  if (value === null || value === undefined || value === "") {
    return options?.emptyText ?? "-";
  }

  const numericValue = Number(value.toString());

  if (Number.isNaN(numericValue)) {
    return "-";
  }

  return `S/ ${numericValue.toFixed(2)}`;
}

const DATE_FORMATS = {
  "d/m/yyyy": {},
  "dd/mm/yyyy": { day: "2-digit", month: "2-digit", year: "numeric" },
  "d mmm yyyy": { dateStyle: "medium" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateFormat = keyof typeof DATE_FORMATS;

type DateOptions = {
  /** "d/m/yyyy": 5/1/2026 · "dd/mm/yyyy": 05/01/2026 · "d mmm yyyy": 5 ene. 2026 */
  format?: DateFormat;
  /** Texto cuando falta la fecha. */
  emptyText?: string;
};

/**
 * Fecha civil (columna `@db.Date`), siempre en UTC: Prisma la entrega como
 * medianoche UTC y en cualquier otra zona se mostraría el día anterior. Para un
 * instante con hora, usa `formatDateTime`.
 */
export function formatDate(
  value: Date | string | null | undefined,
  { format = "d/m/yyyy", emptyText = "-" }: DateOptions = {},
) {
  if (!value) {
    return emptyText;
  }

  return new Intl.DateTimeFormat("es-PE", {
    ...DATE_FORMATS[format],
    timeZone: "UTC",
  }).format(new Date(value));
}

export function formatDateTime(
  value: Date | string | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
    ...opts,
  }).format(new Date(value));
}

export function formatDecimal(value: unknown, decimals = 2) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = Number(value.toString());

  if (Number.isNaN(numericValue)) {
    return "-";
  }

  return numericValue.toFixed(decimals);
}

// Este archivo sirve para centralizar funciones de formateo comunes en toda la aplicación,
//  como formateo de dinero, fechas, etc. De esta manera, evitamos duplicar código y
//  mantenemos un estilo consistente en toda la app.