import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE,
  buildPaginationQueryString,
  getPaginationMeta,
  getPaginationParams,
  parsePageParam,
  parsePageSizeParam,
} from "@/lib/pagination";

describe("parsePageParam", () => {
  it("acepta una pagina valida", () => {
    expect(parsePageParam("3")).toBe(3);
  });

  it("usa la pagina minima para valores negativos, cero, NaN o vacios", () => {
    expect(parsePageParam("-5")).toBe(MIN_PAGE);
    expect(parsePageParam("0")).toBe(MIN_PAGE);
    expect(parsePageParam("no-es-numero")).toBe(MIN_PAGE);
    expect(parsePageParam("")).toBe(MIN_PAGE);
    expect(parsePageParam(undefined)).toBe(MIN_PAGE);
  });

  it("toma el primer valor si llega como arreglo", () => {
    expect(parsePageParam(["2", "5"])).toBe(2);
  });

  it("trunca decimales a un entero valido", () => {
    expect(parsePageParam("2.9")).toBe(2);
  });
});

describe("parsePageSizeParam", () => {
  it("acepta un tamaño de pagina valido", () => {
    expect(parsePageSizeParam("25")).toBe(25);
  });

  it("usa el valor por defecto para valores invalidos, negativos o cero", () => {
    expect(parsePageSizeParam("-10")).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSizeParam("0")).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSizeParam("abc")).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSizeParam(undefined)).toBe(DEFAULT_PAGE_SIZE);
  });

  it("nunca supera MAX_PAGE_SIZE aunque se pida un valor enorme", () => {
    expect(parsePageSizeParam("999999")).toBe(MAX_PAGE_SIZE);
  });

  it("respeta un valor por defecto distinto si se indica", () => {
    expect(parsePageSizeParam(undefined, 10)).toBe(10);
  });
});

describe("getPaginationParams", () => {
  it("calcula skip/take a partir de page/pageSize", () => {
    const result = getPaginationParams({ page: "3", pageSize: "20" });

    expect(result).toEqual({ page: 3, pageSize: 20, skip: 40, take: 20 });
  });

  it("usa la primera pagina y el tamaño por defecto si no hay parametros", () => {
    const result = getPaginationParams({});

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(result.skip).toBe(0);
  });

  it("protege contra page/pageSize maliciosos (negativos o enormes)", () => {
    const result = getPaginationParams({ page: "-1", pageSize: "100000" });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(MAX_PAGE_SIZE);
    expect(result.skip).toBe(0);
  });
});

describe("getPaginationMeta", () => {
  it("calcula totalPages y hasNext/hasPrevious correctamente", () => {
    const meta = getPaginationMeta({ totalItems: 45, page: 2, pageSize: 20 });

    expect(meta).toEqual({
      page: 2,
      pageSize: 20,
      totalItems: 45,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  it("no marca pagina anterior en la primera pagina", () => {
    const meta = getPaginationMeta({ totalItems: 45, page: 1, pageSize: 20 });

    expect(meta.hasPreviousPage).toBe(false);
    expect(meta.hasNextPage).toBe(true);
  });

  it("no marca pagina siguiente en la ultima pagina", () => {
    const meta = getPaginationMeta({ totalItems: 45, page: 3, pageSize: 20 });

    expect(meta.hasNextPage).toBe(false);
  });

  it("acota la pagina visible entre 1 y totalPages si se pide una pagina fuera de rango", () => {
    const meta = getPaginationMeta({ totalItems: 10, page: 999, pageSize: 20 });

    expect(meta.totalPages).toBe(1);
    expect(meta.page).toBe(1);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPreviousPage).toBe(false);
  });

  it("siempre reporta al menos 1 pagina, incluso sin resultados", () => {
    const meta = getPaginationMeta({ totalItems: 0, page: 1, pageSize: 20 });

    expect(meta.totalPages).toBe(1);
    expect(meta.totalItems).toBe(0);
  });

  it("nunca reporta un total de items negativo", () => {
    const meta = getPaginationMeta({ totalItems: -5, page: 1, pageSize: 20 });

    expect(meta.totalItems).toBe(0);
  });
});

describe("buildPaginationQueryString", () => {
  it("conserva los filtros existentes y sobreescribe la pagina", () => {
    const query = buildPaginationQueryString(
      { q: "acero", status: "activo", page: "1" },
      { page: 2 },
    );

    const parsed = new URLSearchParams(query);

    expect(parsed.get("q")).toBe("acero");
    expect(parsed.get("status")).toBe("activo");
    expect(parsed.get("page")).toBe("2");
  });

  it("elimina una clave cuando el override es undefined/null/vacio", () => {
    const query = buildPaginationQueryString(
      { q: "acero", page: "2" },
      { page: undefined },
    );

    const parsed = new URLSearchParams(query);

    expect(parsed.has("page")).toBe(false);
    expect(parsed.get("q")).toBe("acero");
  });

  it("no incluye filtros vacios", () => {
    const query = buildPaginationQueryString({ q: "", status: "activo" }, {});

    const parsed = new URLSearchParams(query);

    expect(parsed.has("q")).toBe(false);
    expect(parsed.get("status")).toBe("activo");
  });
});
