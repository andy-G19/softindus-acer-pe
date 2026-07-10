import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXPORT_LIMIT,
  MAX_EXCEL_EXPORT_ROWS,
  MAX_PDF_EXPORT_ROWS,
  clampExportLimit,
  getMaxRowsForFormat,
  sanitizeExportFilename,
} from "@/lib/reports/export-limits";

describe("getMaxRowsForFormat", () => {
  it("devuelve el maximo de PDF para format=pdf", () => {
    expect(getMaxRowsForFormat("pdf")).toBe(MAX_PDF_EXPORT_ROWS);
  });

  it("devuelve el maximo de Excel para format=excel", () => {
    expect(getMaxRowsForFormat("excel")).toBe(MAX_EXCEL_EXPORT_ROWS);
  });
});

describe("clampExportLimit", () => {
  it("nunca supera MAX_PDF_EXPORT_ROWS para PDF", () => {
    expect(clampExportLimit(999999, "pdf")).toBe(MAX_PDF_EXPORT_ROWS);
  });

  it("nunca supera MAX_EXCEL_EXPORT_ROWS para Excel", () => {
    expect(clampExportLimit(999999, "excel")).toBe(MAX_EXCEL_EXPORT_ROWS);
  });

  it("acepta un valor valido dentro del maximo", () => {
    expect(clampExportLimit(50, "pdf")).toBe(50);
    expect(clampExportLimit(2000, "excel")).toBe(2000);
  });

  it("usa el default (acotado al maximo del formato) para valores invalidos", () => {
    expect(clampExportLimit(undefined, "excel")).toBe(DEFAULT_EXPORT_LIMIT);
    expect(clampExportLimit(0, "excel")).toBe(DEFAULT_EXPORT_LIMIT);
    expect(clampExportLimit(-10, "excel")).toBe(DEFAULT_EXPORT_LIMIT);
    expect(clampExportLimit(Number.NaN, "excel")).toBe(DEFAULT_EXPORT_LIMIT);
  });

  it("trunca valores decimales a un entero", () => {
    expect(clampExportLimit(10.9, "pdf")).toBe(10);
  });
});

describe("sanitizeExportFilename", () => {
  it("conserva un nombre de archivo ya seguro", () => {
    expect(sanitizeExportFilename("reporte_produccion_2026-07-10.xlsx")).toBe(
      "reporte_produccion_2026-07-10.xlsx",
    );
  });

  it("elimina caracteres peligrosos o de inyeccion de headers", () => {
    const result = sanitizeExportFilename(
      'reporte"; evil.pdf\r\nSet-Cookie: a=b',
    );

    expect(result).not.toContain('"');
    expect(result).not.toContain("\r");
    expect(result).not.toContain("\n");
    expect(result).not.toContain(":");
    expect(result).not.toContain(" ");
  });

  it("elimina separadores de ruta (el nombre nunca se usa como path de archivo)", () => {
    const result = sanitizeExportFilename("../../etc/passwd");

    expect(result).not.toContain("/");
    expect(result).not.toContain("\\");
  });

  it("genera un nombre estable ante entradas vacias o solo simbolos", () => {
    expect(sanitizeExportFilename("")).toBe("reporte");
    expect(sanitizeExportFilename("****")).toBe("reporte");
  });

  it("limita la longitud del nombre resultante", () => {
    const longName = `${"a".repeat(300)}.xlsx`;

    expect(sanitizeExportFilename(longName).length).toBeLessThanOrEqual(150);
  });
});
