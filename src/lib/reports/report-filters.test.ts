import { describe, expect, it } from "vitest";

import { MAX_DATE_RANGE_DAYS } from "@/lib/reports/export-limits";
import {
  normalizeReportTextParam,
  parseExportFormat,
  parseExportLimit,
  parseReportKey,
  validateDateRange,
} from "@/lib/reports/report-filters";

describe("parseReportKey", () => {
  it("acepta un reporte real del registro", () => {
    const result = parseReportKey("production");

    expect(result.ok).toBe(true);
  });

  it("rechaza un reporte desconocido", () => {
    const result = parseReportKey("no-existe");

    expect(result.ok).toBe(false);
  });
});

describe("parseExportFormat", () => {
  it("acepta pdf", () => {
    const result = parseExportFormat("pdf");

    expect(result).toEqual({ ok: true, value: "pdf" });
  });

  it("acepta excel", () => {
    const result = parseExportFormat("excel");

    expect(result).toEqual({ ok: true, value: "excel" });
  });

  it("trata la ausencia de formato como excel (compatibilidad con URLs actuales)", () => {
    const result = parseExportFormat(null);

    expect(result).toEqual({ ok: true, value: "excel" });
  });

  it("rechaza un formato invalido", () => {
    const result = parseExportFormat("xml");

    expect(result.ok).toBe(false);
  });

  it("es insensible a mayusculas/minusculas", () => {
    expect(parseExportFormat("PDF")).toEqual({ ok: true, value: "pdf" });
  });
});

describe("validateDateRange", () => {
  it("acepta un rango valido", () => {
    const result = validateDateRange(
      new Date("2026-01-01"),
      new Date("2026-01-31"),
    );

    expect(result.ok).toBe(true);
  });

  it("acepta cuando falta una de las dos fechas", () => {
    expect(validateDateRange(new Date("2026-01-01"), undefined).ok).toBe(true);
    expect(validateDateRange(undefined, new Date("2026-01-31")).ok).toBe(true);
  });

  it("rechaza fechaDesde mayor que fechaHasta", () => {
    const result = validateDateRange(
      new Date("2026-02-01"),
      new Date("2026-01-01"),
    );

    expect(result.ok).toBe(false);
  });

  it("rechaza un rango que supera MAX_DATE_RANGE_DAYS", () => {
    const from = new Date("2020-01-01");
    const to = new Date(from.getTime() + (MAX_DATE_RANGE_DAYS + 10) * 86400000);

    const result = validateDateRange(from, to);

    expect(result.ok).toBe(false);
  });

  it("acepta un rango justo en el limite maximo", () => {
    const from = new Date("2020-01-01");
    const to = new Date(from.getTime() + MAX_DATE_RANGE_DAYS * 86400000);

    const result = validateDateRange(from, to);

    expect(result.ok).toBe(true);
  });
});

describe("parseExportLimit", () => {
  it("acota un limite enorme al maximo del formato", () => {
    expect(parseExportLimit("9999999", "pdf")).toBeLessThanOrEqual(500);
    expect(parseExportLimit("9999999", "excel")).toBeLessThanOrEqual(5000);
  });

  it("usa el default cuando no se envia limit", () => {
    expect(parseExportLimit(null, "excel")).toBeGreaterThan(0);
  });

  it("ignora un limit no numerico y usa el default", () => {
    expect(parseExportLimit("abc", "excel")).toBeGreaterThan(0);
  });
});

describe("normalizeReportTextParam", () => {
  it("recorta espacios en blanco", () => {
    expect(normalizeReportTextParam("  activo  ")).toBe("activo");
  });

  it("devuelve string vacio para null/undefined", () => {
    expect(normalizeReportTextParam(null)).toBe("");
    expect(normalizeReportTextParam(undefined)).toBe("");
  });

  it("limita la longitud del texto", () => {
    const longValue = "a".repeat(500);

    expect(normalizeReportTextParam(longValue).length).toBeLessThanOrEqual(200);
  });
});
