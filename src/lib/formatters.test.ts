import { afterEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { formatDate, formatMoney } from "@/lib/formatters";

// Pruebas de caracterizacion: fijan lo que hoy muestran estos formateadores para
// que unificar las copias locales no cambie ningun texto en pantalla.

// Se prueba el comportamiento en ejecucion, tambien con entradas que el tipo
// podria rechazar (datos sin tipar, `any`): por eso se llama con una firma laxa.
const formatMoneyAtRuntime = formatMoney as (value: unknown) => string;

describe("formatMoney", () => {
  it("muestra un guion cuando falta el monto", () => {
    expect(formatMoneyAtRuntime(null)).toBe("-");
    expect(formatMoneyAtRuntime(undefined)).toBe("-");
    expect(formatMoneyAtRuntime("")).toBe("-");
  });

  it("muestra un guion cuando el valor no es numerico", () => {
    expect(formatMoneyAtRuntime(Number.NaN)).toBe("-");
    expect(formatMoneyAtRuntime("abc")).toBe("-");
  });

  it("antepone S/ y fija dos decimales, sin separador de miles", () => {
    expect(formatMoneyAtRuntime(0)).toBe("S/ 0.00");
    expect(formatMoneyAtRuntime("15.3")).toBe("S/ 15.30");
    expect(formatMoneyAtRuntime(new Prisma.Decimal("1234.5"))).toBe(
      "S/ 1234.50",
    );
    expect(formatMoneyAtRuntime(new Prisma.Decimal("9999999999.99"))).toBe(
      "S/ 9999999999.99",
    );
  });

  it("conserva el signo de los montos negativos", () => {
    expect(formatMoneyAtRuntime(-12.5)).toBe("S/ -12.50");
  });

  it("no muestra el cero negativo", () => {
    expect(formatMoneyAtRuntime(-0)).toBe("S/ 0.00");
  });

  it("redondea como toFixed sobre el number, no sobre el Decimal", () => {
    // El monto pasa por coma flotante: 1.005 y 2.675 se guardan como
    // 1.00499... y 2.67499..., y bajan. Revisar el redondeo de importes es una
    // decision aparte; esta prueba solo fija la regla vigente.
    expect(formatMoneyAtRuntime(1.005)).toBe("S/ 1.00");
    expect(formatMoneyAtRuntime(new Prisma.Decimal("2.675"))).toBe("S/ 2.67");
    expect(formatMoneyAtRuntime(0.125)).toBe("S/ 0.13");
    expect(formatMoneyAtRuntime(new Prisma.Decimal("-0.005"))).toBe(
      "S/ -0.01",
    );
  });
});

describe.each(["America/Lima", "UTC"])(
  "formatDate con el proceso en %s",
  (timeZone) => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    function useProcessTimeZone() {
      vi.stubEnv("TZ", timeZone);
      // Si el cambio de zona no surtiera efecto, las pruebas pasarian sin
      // demostrar nada.
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(timeZone);
    }

    it("muestra un guion cuando falta la fecha", () => {
      useProcessTimeZone();

      expect(formatDate(null)).toBe("-");
      expect(formatDate(undefined)).toBe("-");
      expect(formatDate("")).toBe("-");
    });

    it("usa el formato numerico de es-PE sin ceros a la izquierda", () => {
      useProcessTimeZone();

      expect(formatDate(new Date(Date.UTC(2026, 0, 5)))).toBe("5/1/2026");
    });

    it("muestra el dia en UTC, sin importar la zona del proceso", () => {
      useProcessTimeZone();

      // Una columna @db.Date llega como medianoche UTC. En Lima son las 19:00
      // del dia anterior: formatear en la zona del proceso mostraria 30/9/2026.
      expect(formatDate(new Date("2026-10-01T00:00:00.000Z"))).toBe(
        "1/10/2026",
      );
      expect(formatDate(new Date("2026-10-01T03:30:00.000Z"))).toBe(
        "1/10/2026",
      );
      expect(formatDate(new Date("2026-12-31T23:30:00.000Z"))).toBe(
        "31/12/2026",
      );
    });

    it("acepta texto ISO, con hora o solo fecha", () => {
      useProcessTimeZone();

      expect(formatDate("2026-10-01T00:00:00.000Z")).toBe("1/10/2026");
      expect(formatDate("2026-10-01")).toBe("1/10/2026");
    });

    it("lanza RangeError con una fecha invalida", () => {
      useProcessTimeZone();

      expect(() => formatDate(new Date("no es fecha"))).toThrow(RangeError);
    });
  },
);

describe("formatMoney con texto de vacio", () => {
  it("usa el texto indicado cuando falta el monto", () => {
    expect(formatMoney(null, { emptyText: "Sin precio" })).toBe("Sin precio");
    expect(formatMoney(undefined, { emptyText: "-" })).toBe("-");
    expect(formatMoney("", { emptyText: "Sin precio" })).toBe("Sin precio");
  });

  it("no cambia la presentacion de un monto presente", () => {
    expect(
      formatMoney(new Prisma.Decimal("15.3"), { emptyText: "Sin precio" }),
    ).toBe("S/ 15.30");
  });

  it("muestra un guion si el valor no es numerico, aunque haya texto de vacio", () => {
    expect(formatMoney("abc", { emptyText: "Sin precio" })).toBe("-");
  });

  it("cuando falta significa cero, quien llama lo expresa con ?? 0", () => {
    const totalSinRegistros = null as Prisma.Decimal | null;

    expect(formatMoney(totalSinRegistros ?? 0)).toBe("S/ 0.00");
  });

  it("obliga a decidir que mostrar si el monto puede faltar", () => {
    // Comprobacion de tipos: la verifica typecheck, no la ejecucion.
    const montoOpcional = null as Prisma.Decimal | null;

    // @ts-expect-error: sin opciones solo acepta un monto presente
    formatMoney(montoOpcional);

    expect(formatMoney(montoOpcional, { emptyText: "-" })).toBe("-");
  });
});

describe.each(["America/Lima", "UTC"])(
  "formatDate con opciones y el proceso en %s",
  (timeZone) => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    function useProcessTimeZone() {
      vi.stubEnv("TZ", timeZone);
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(timeZone);
    }

    it("dd/mm/yyyy completa con ceros a la izquierda", () => {
      useProcessTimeZone();

      expect(
        formatDate(new Date(Date.UTC(2026, 0, 5)), { format: "dd/mm/yyyy" }),
      ).toBe("05/01/2026");
    });

    it("d mmm yyyy usa el formato medio de es-PE", () => {
      useProcessTimeZone();

      expect(
        formatDate(new Date(Date.UTC(2026, 0, 5)), { format: "d mmm yyyy" }),
      ).toBe("5 ene. 2026");
    });

    it("todos los formatos muestran el dia en UTC", () => {
      useProcessTimeZone();

      const instant = new Date("2026-10-01T03:30:00.000Z");

      expect(formatDate(instant, { format: "d/m/yyyy" })).toBe("1/10/2026");
      expect(formatDate(instant, { format: "dd/mm/yyyy" })).toBe("01/10/2026");
      expect(formatDate(instant, { format: "d mmm yyyy" })).toBe(
        "1 oct. 2026",
      );
    });

    it("usa el texto indicado cuando falta la fecha", () => {
      useProcessTimeZone();

      expect(formatDate(null, { format: "dd/mm/yyyy", emptyText: "" })).toBe(
        "",
      );
      expect(formatDate(undefined, { format: "dd/mm/yyyy" })).toBe("-");
    });

    it("solo admite los formatos definidos", () => {
      useProcessTimeZone();

      // Comprobacion de tipos: la verifica typecheck, no la ejecucion.
      // @ts-expect-error: formato no definido
      formatDate(new Date(), { format: "yyyy-mm-dd" });
    });
  },
);
