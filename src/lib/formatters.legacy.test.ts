import { afterEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { formatDate, formatMoney } from "@/lib/formatters";
import type { NumericInput } from "@/lib/numbers";
import { toNonNegativeNumber, toNumber } from "@/lib/numbers";

// Pruebas de equivalencia con oraculo. Cada funcion legacy* es una copia literal,
// solo renombrada, de una variante local que la entrega 3 reemplaza por la version
// compartida. Cada prueba compara la variante con la llamada que la sustituye sobre
// los valores que esas pantallas reciben de verdad: Decimal de Prisma, number, el
// texto de Decimal.toString() en los componentes cliente, null y undefined. Las
// diferencias fuera de ese dominio quedan fijadas en el ultimo bloque.
//
// No se incluye el formatMoney de waste-scrap/page.tsx: sus dos llamadas pasan a
// `S/ ${formatNumber(x)}`, que es su propia definicion.

// --- Copias de las variantes locales -------------------------------------------

// toNumber: 48 copias.
function legacyToNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

// toNumber de modules/dashboard/utils.ts y production/work-orders/actions.ts.
function legacyToNumberSinNaN(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numericValue = Number(value.toString());

  return Number.isNaN(numericValue) ? 0 : numericValue;
}

// toNumber de lib/costing.ts y costs/costings/actions.ts.
function legacyToNumberNoNegativo(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numberValue = Number(value.toString());

  if (Number.isNaN(numberValue) || numberValue < 0) {
    return 0;
  }

  return numberValue;
}

// formatMoney: 25 copias; con el toNumber de 48 copias.
function legacyMoneyCero(value: unknown) {
  return `S/ ${legacyToNumber(value).toFixed(2)}`;
}

// formatMoney de las tres paginas de detalle de recetas.
function legacyMoneyCeroExplicito(value: unknown) {
  if (value === null || value === undefined) {
    return "S/ 0.00";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

// formatMoney de payment-form.tsx y receipt-form.tsx.
function legacyMoneyTexto(value: string | number) {
  return `S/ ${Number(value).toFixed(2)}`;
}

// formatMoney de quote-form.tsx.
function legacyMoneyProforma(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "S/ 0.00";
  }

  return `S/ ${Number(value).toFixed(2)}`;
}

// formatMoney: 15 copias.
function legacyMoneyGuion(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

// formatMoney de order-form.tsx.
function legacyMoneySinPrecio(value: string | null) {
  if (!value) {
    return "Sin precio";
  }

  return `S/ ${Number(value).toFixed(2)}`;
}

// formatDate dd/mm/aaaa: 29 copias.
function legacyDateCorta(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

// formatDate d/m/aaaa: 12 copias.
function legacyDateNumerica(value: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", { timeZone: "UTC" }).format(
    new Date(value),
  );
}

// formatDate con formato medio: 8 copias.
function legacyDateMedia(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}

// formatDate de api/reports/export/[report]/route.ts.
function legacyDateExportacion(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

// formatDate de quote-form.tsx.
function legacyDateProforma(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", { timeZone: "UTC" }).format(
    new Date(value),
  );
}

// --- Dominio: lo que las pantallas reciben -------------------------------------

const decimals = [
  "0",
  "1",
  "0.1",
  "15.3",
  "1234.5",
  "-7.25",
  "-12.345",
  "0.005",
  "2.675",
  "-0.005",
  "100000.999",
  "9999999999.99",
].map((value) => new Prisma.Decimal(value));

const numbers = [
  0, -0, 1, 12.5, -7.25, 1.005, 0.125, 2.675, 1 / 3, -1 / 3, 100000.999,
  9999999999.99,
];

// Los componentes cliente reciben los Decimal serializados con toString().
const decimalStrings = decimals.map((value) => value.toString());

const present: NonNullable<NumericInput>[] = [...decimals, ...numbers];
const absent = [null, undefined];

const dates = [
  "2026-01-05T00:00:00.000Z",
  "2026-10-01T00:00:00.000Z",
  "2026-12-31T00:00:00.000Z",
  "2024-02-29T00:00:00.000Z",
  // Instantes: en Lima, los tres primeros todavia son el dia anterior.
  "2026-10-01T03:30:00.000Z",
  "2026-10-01T04:59:59.999Z",
  "2026-12-31T23:30:00.000Z",
  "2026-10-01T05:00:00.000Z",
].map((iso) => new Date(iso));

// quote-form.tsx recibe las fechas serializadas con toISOString().
const isoStrings = dates.map((value) => value.toISOString());

function expectSameOutput<T>(
  values: T[],
  legacy: (value: T) => unknown,
  shared: (value: T) => unknown,
) {
  for (const value of values) {
    expect(shared(value), `entrada: ${String(value)}`).toBe(legacy(value));
  }
}

// --- Equivalencias ---------------------------------------------------------------

describe("toNumber compartido frente a las copias locales", () => {
  it("equivale a las 48 copias mayoritarias", () => {
    expectSameOutput([...present, ...absent, ""], legacyToNumber, toNumber);
  });

  it("equivale a la copia que convierte NaN en cero", () => {
    expectSameOutput(
      [...present, ...absent, ""],
      legacyToNumberSinNaN,
      toNumber,
    );
  });

  it("toNonNegativeNumber equivale a la copia de costeo con Decimal", () => {
    // Sus llamadas reciben columnas Decimal, opcionales o no.
    expectSameOutput(
      [...decimals, ...absent],
      legacyToNumberNoNegativo,
      toNonNegativeNumber,
    );
  });
});

describe("formatMoney compartido frente a las copias locales", () => {
  it("equivale a las 25 copias que muestran S/ 0.00 si falta el monto", () => {
    expectSameOutput(present, legacyMoneyCero, (value) => formatMoney(value));
    expectSameOutput(
      [...present, ...absent],
      legacyMoneyCero,
      (value: NumericInput) => formatMoney(value ?? 0),
    );
  });

  it("equivale a la copia de recetas que muestra S/ 0.00 si falta el monto", () => {
    expectSameOutput(
      [...present, ...absent],
      legacyMoneyCeroExplicito,
      (value: NumericInput) => formatMoney(value ?? 0),
    );
  });

  it("equivale a la copia de pagos y comprobantes", () => {
    expectSameOutput(
      [...decimalStrings, ...numbers],
      legacyMoneyTexto,
      (value) => formatMoney(value),
    );
  });

  it("equivale a la copia de proformas", () => {
    expectSameOutput(
      [...decimalStrings, ...numbers],
      legacyMoneyProforma,
      (value) => formatMoney(value),
    );
  });

  it("equivale a las 15 copias que muestran un guion si falta el monto", () => {
    expectSameOutput(present, legacyMoneyGuion, (value) => formatMoney(value));
    expectSameOutput([...present, ...absent], legacyMoneyGuion, (value) =>
      formatMoney(value, { emptyText: "-" }),
    );
  });

  it("equivale a la copia de pedidos que muestra Sin precio", () => {
    expectSameOutput([...decimalStrings, null], legacyMoneySinPrecio, (value) =>
      formatMoney(value, { emptyText: "Sin precio" }),
    );
  });
});

describe.each(["America/Lima", "UTC"])(
  "formatDate compartido frente a las copias locales, con el proceso en %s",
  (timeZone) => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    function useProcessTimeZone() {
      vi.stubEnv("TZ", timeZone);
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(timeZone);
    }

    it("equivale a las 29 copias dd/mm/aaaa", () => {
      useProcessTimeZone();

      expectSameOutput([...dates, ...absent], legacyDateCorta, (value) =>
        formatDate(value, { format: "dd/mm/yyyy" }),
      );
    });

    it("equivale a las 12 copias d/m/aaaa", () => {
      useProcessTimeZone();

      expectSameOutput(
        [...dates, ...isoStrings, null],
        legacyDateNumerica,
        (value) => formatDate(value),
      );
    });

    it("equivale a las 8 copias con formato medio", () => {
      useProcessTimeZone();

      expectSameOutput([...dates, ...absent], legacyDateMedia, (value) =>
        formatDate(value, { format: "d mmm yyyy" }),
      );
    });

    it("equivale a la copia de la exportacion de reportes", () => {
      useProcessTimeZone();

      expectSameOutput([...dates, ...absent], legacyDateExportacion, (value) =>
        formatDate(value, { format: "dd/mm/yyyy", emptyText: "" }),
      );
    });

    it("equivale a la copia de proformas", () => {
      useProcessTimeZone();

      expectSameOutput([...isoStrings, null], legacyDateProforma, (value) =>
        formatDate(value),
      );
    });
  },
);

// --- Fuera del dominio -------------------------------------------------------------

describe("diferencias con entradas que las pantallas no reciben", () => {
  it("toNumber devuelve NaN donde dos copias devolvian cero", () => {
    expect(legacyToNumberSinNaN("abc")).toBe(0);
    expect(toNumber("abc")).toBeNaN();
  });

  it("toNonNegativeNumber anula el infinito y conserva el cero negativo", () => {
    // La copia de costeo solo recibe Decimal, que no llega como infinito ni -0.
    expect(legacyToNumberNoNegativo(Number.POSITIVE_INFINITY)).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(toNonNegativeNumber(Number.POSITIVE_INFINITY)).toBe(0);
    expect(Object.is(legacyToNumberNoNegativo(-0), 0)).toBe(true);
    expect(Object.is(toNonNegativeNumber(-0), -0)).toBe(true);
  });

  it("formatMoney muestra un guion para NaN en lugar de S/ NaN", () => {
    expect(legacyMoneyCero(Number.NaN)).toBe("S/ NaN");
    expect(legacyMoneyGuion(Number.NaN)).toBe("S/ NaN");
    expect(formatMoney(Number.NaN)).toBe("-");
  });

  it("formatMoney trata la cadena vacia como monto ausente", () => {
    expect(legacyMoneyCero("")).toBe("S/ 0.00");
    expect(legacyMoneyGuion("")).toBe("S/ 0.00");
    expect(legacyMoneyProforma("")).toBe("S/ 0.00");
    expect(formatMoney("")).toBe("-");
  });
});
