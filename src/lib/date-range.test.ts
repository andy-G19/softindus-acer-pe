import { describe, expect, it } from "vitest";

import { DATE_RANGE_INVERTED_MESSAGE, isDateRangeInverted, isDateTimeInputValue, toDateInputValue } from "@/lib/date-range";
import { parseReportDate, validateDateRange } from "@/lib/reports/report-filters";

describe("isDateRangeInverted", () => {
  it.each([
    ["2026-10-13", "2026-10-01", true],
    ["2026-10-01", "2026-10-13", false],
    ["2026-10-01", "2026-10-01", false],
    ["2025-12-31", "2026-01-01", false],
    ["2026-01-01", "2025-12-31", true],
    ["2026-09-30", "2026-10-01", false],
    ["", "2026-10-01", false],
    ["2026-10-13", "", false],
    [undefined, undefined, false],
  ])("desde %s hasta %s: %s", (from, to, expected) => {
    expect(isDateRangeInverted(from, to)).toBe(expected);
  });

  it("ordena igual que las fechas que lee la ruta de exportacion", () => {
    const pairs = [
      ["2026-10-13", "2026-10-01"],
      ["2025-12-31", "2026-01-01"],
      ["2026-09-30", "2026-10-01"],
    ] as const;

    for (const [from, to] of pairs) {
      const byDate = (parseReportDate(from)?.getTime() ?? 0) > (parseReportDate(to)?.getTime() ?? 0);

      expect(isDateRangeInverted(from, to)).toBe(byDate);
    }
  });
});

// Entrega 10.2: un input type="date" solo conserva una fecha "aaaa-mm-dd" que
// existe; cualquier otro valor lo deja vacio. DateRangeFields valida lo mismo
// que el campo muestra.
describe("toDateInputValue", () => {
  it.each([
    ["2026-10-01", "2026-10-01"],
    ["2024-02-29", "2024-02-29"],
    ["2026-7-5", ""],
    ["2026-02-30", ""],
    ["2026-02-29", ""],
    ["2026-13-01", ""],
    ["2026-00-10", ""],
    ["0000-01-01", ""],
    [" 2026-10-01", ""],
    ["2026-10-01T00:00", ""],
    ["", ""],
    [undefined, ""],
  ])("%s queda como %j", (value, expected) => {
    expect(toDateInputValue(value)).toBe(expected);
  });
});

describe("mensaje del rango invertido", () => {
  it("la ruta de exportacion y el navegador usan el mismo texto", () => {
    const result = validateDateRange(parseReportDate("2026-10-13"), parseReportDate("2026-10-01"));

    expect(result).toEqual({ ok: false, error: DATE_RANGE_INVERTED_MESSAGE });
    expect(DATE_RANGE_INVERTED_MESSAGE).toBe("La fecha inicial no puede ser mayor que la fecha final.");
  });
});

describe("isDateTimeInputValue", () => {
  it.each(["2026-07-14T09:30", "2026-07-14T23:59", "2026-07-14T00:00:59", "2024-02-29T10:00"])(
    "acepta %s",
    (value) => {
      expect(isDateTimeInputValue(value)).toBe(true);
    },
  );

  it.each([
    "2026-02-30T10:00",
    "2025-02-29T10:00",
    "2026-07-14T24:00",
    "2026-07-14T09:60",
    "2026-07-14T09:30:60",
    "2026-07-14 09:30",
    "2026-07-14",
    "2026-07-14T09:30:15.123",
    "",
    "July 14 2026",
  ])("rechaza %j", (value) => {
    expect(isDateTimeInputValue(value)).toBe(false);
  });
});
