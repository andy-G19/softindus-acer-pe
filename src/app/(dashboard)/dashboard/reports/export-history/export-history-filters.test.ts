import { describe, expect, it, vi } from "vitest";

import {
  characterizePage,
  preloadPages,
} from "@/testing/page-characterization";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock(),
);
vi.mock("@/lib/authz", async () =>
  (await import("@/testing/page-characterization")).authzModuleMock(),
);
vi.mock("next/navigation", async (importOriginal) =>
  (await import("@/testing/page-characterization")).navigationModuleMock(
    await importOriginal(),
  ),
);

// C3 de la 11.7b (D88): el historial de exportaciones tenia su propia copia de
// getSearchParam, la unica que no recortaba los espacios. Con un filtro pegado con un
// espacio (?module=%20Reporte...) la lista salia vacia, y en cualquier otro listado el
// mismo valor filtra. Ahora recorta como todos: con o sin espacios, la pagina hace las
// mismas consultas y muestra lo mismo.

const loadPage = () => import("./page");
const route = "/dashboard/reports/export-history";

preloadPages(loadPage);

function render(name: string, searchParams: Record<string, string>) {
  return characterizePage(loadPage, { name, searchParams }, route);
}

const filtros = {
  dateFrom: "2026-07-01",
  dateTo: "2026-07-31",
  module: "Reporte financiero",
  format: "pdf",
  status: "generada",
  userId: "USU00000002",
  searchText: "produccion",
};

function conEspacios(params: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, ` ${value} `]),
  );
}

describe("C3 de la 11.7b: filtros del historial de exportaciones", () => {
  it("un filtro con espacios consulta lo mismo que sin ellos", async () => {
    const limpio = await render("sin espacios", filtros);
    const espaciado = await render("con espacios", conEspacios(filtros));

    expect(espaciado.calls).toEqual(limpio.calls);
  });

  it("y muestra lo mismo, con los campos ya recortados", async () => {
    const limpio = await render("sin espacios", filtros);
    const espaciado = await render("con espacios", conEspacios(filtros));

    expect(espaciado.html).toEqual(limpio.html);
  });

  it("un rango invertido con espacios se reconoce como invertido", async () => {
    const invertido = { dateFrom: "2026-07-31", dateTo: "2026-07-01" };
    const limpio = await render("invertido", invertido);
    const espaciado = await render("invertido con espacios", conEspacios(invertido));

    expect(espaciado.calls).toEqual(limpio.calls);
    expect(espaciado.html).toEqual(limpio.html);
  });
});
