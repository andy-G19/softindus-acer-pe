import { describe, expect, it } from "vitest";

import { buildDateRangeFilter, parseDateParam, parseStringParam } from "@/lib/search-params";

describe("parseStringParam", () => {
  it("recorta espacios en blanco", () => {
    expect(parseStringParam({ q: "  acero  " }, "q")).toBe("acero");
  });

  it("devuelve string vacio si el parametro no existe", () => {
    expect(parseStringParam({}, "q")).toBe("");
  });

  it("toma el primer valor si el parametro llega como arreglo", () => {
    expect(parseStringParam({ q: ["uno", "dos"] }, "q")).toBe("uno");
  });

  it("protege contra strings demasiado largos (limite defensivo)", () => {
    const longValue = "a".repeat(500);
    const result = parseStringParam({ q: longValue }, "q");

    expect(result.length).toBeLessThanOrEqual(200);
  });
});

// Medianoche en la zona del proceso, como la da parseDateParam: las pruebas no
// dependen de la zona de la maquina que las ejecuta.
function day(year: number, month: number, date: number) {
  return new Date(year, month - 1, date);
}

// Rango de fechas de los listados (hallazgo 6 de la 10.3a, corregido en la
// 10.3c): desde el inicio del primer dia hasta antes del dia siguiente al
// ultimo, la regla que buildReportDateRange aplica en los reportes. Con lte a
// las 23:59:59.999 se perdian los instantes del ultimo milisegundo del dia,
// porque timestamptz guarda microsegundos.
describe("buildDateRangeFilter", () => {
  it("sin fechas no filtra", () => {
    expect(buildDateRangeFilter(null, null)).toBeUndefined();
  });

  it("va desde el inicio del primer dia hasta antes del dia siguiente al ultimo", () => {
    expect(buildDateRangeFilter(day(2026, 7, 1), day(2026, 7, 31))).toEqual({
      gte: day(2026, 7, 1),
      lt: day(2026, 8, 1),
    });
  });

  it("el ultimo dia entra completo, tambien su ultimo milisegundo", () => {
    const filter = buildDateRangeFilter(null, day(2026, 7, 31));
    const lastMillisecond = new Date(2026, 6, 31, 23, 59, 59, 999);

    expect(filter).not.toHaveProperty("lte");
    expect(filter?.lt?.getTime()).toBeGreaterThan(lastMillisecond.getTime());
  });

  it("solo con desde no pone limite superior", () => {
    expect(buildDateRangeFilter(day(2026, 7, 1), null)).toEqual({ gte: day(2026, 7, 1) });
  });

  it("solo con hasta llega hasta antes del dia siguiente", () => {
    expect(buildDateRangeFilter(null, day(2026, 7, 31))).toEqual({ lt: day(2026, 8, 1) });
  });

  it("el dia siguiente cambia de mes y de anio", () => {
    expect(buildDateRangeFilter(null, day(2026, 12, 31))).toEqual({ lt: day(2027, 1, 1) });
  });

  it("el dia siguiente respeta febrero de un anio bisiesto", () => {
    expect(buildDateRangeFilter(null, day(2028, 2, 28))).toEqual({ lt: day(2028, 2, 29) });
  });

  it("no modifica la fecha que recibe", () => {
    const to = day(2026, 7, 31);

    buildDateRangeFilter(null, to);

    expect(to).toEqual(day(2026, 7, 31));
  });

  it("parte de las fechas que da parseDateParam", () => {
    const params = { from: "2026-07-01", to: "2026-07-31" };

    expect(
      buildDateRangeFilter(parseDateParam(params, "from"), parseDateParam(params, "to")),
    ).toEqual({ gte: day(2026, 7, 1), lt: day(2026, 8, 1) });
  });
});
