import { describe, expect, it } from "vitest";

import { DATE_RANGE_INVERTED_MESSAGE, isDateRangeInverted } from "@/lib/date-range";
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

describe("mensaje del rango invertido", () => {
  it("la ruta de exportacion y el navegador usan el mismo texto", () => {
    const result = validateDateRange(parseReportDate("2026-10-13"), parseReportDate("2026-10-01"));

    expect(result).toEqual({ ok: false, error: DATE_RANGE_INVERTED_MESSAGE });
    expect(DATE_RANGE_INVERTED_MESSAGE).toBe("La fecha inicial no puede ser mayor que la fecha final.");
  });
});
