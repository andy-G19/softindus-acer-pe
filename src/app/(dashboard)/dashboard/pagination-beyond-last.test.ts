import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { characterizePage, preloadPages } from "@/testing/page-characterization";

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

// C3 del grupo de fixes (D126, hallazgo 6 de la 11.3c): una pagina posterior a la ultima (un enlace
// viejo, o anular la ultima fila de la ultima pagina) consultaba con su `skip` y mostraba la tabla
// vacia con «Todavia no hay … registrados», «Pagina 1 de 1» y los dos botones deshabilitados: no
// habia forma de volver salvo «Limpiar». `getPaginationMeta` recortaba la pagina que se muestra,
// pero no la que se consulto. Ahora la pagina redirige a la ultima, con los mismos filtros.

const ORDERS_ROUTE = "/dashboard/commercial/orders";
const loadOrders = () => import("./commercial/orders/page");

preloadPages(loadOrders);

async function openOrders(searchParams: Record<string, string>, totalItems: number) {
  return characterizePage(
    loadOrders,
    {
      name: "pagina fuera de rango",
      searchParams,
      data: { "pedido.findMany": [], "pedido.count": totalItems },
    },
    ORDERS_ROUTE,
  );
}

describe("C3 del grupo de fixes: una pagina que no existe lleva a la ultima", () => {
  it("con 45 pedidos, la pagina 99 redirige a la 3 con sus filtros", async () => {
    const result = await openOrders({ status: "registrado", page: "99" }, 45);

    expect(result.outcome).toBe(`redirect:${ORDERS_ROUTE}?status=registrado&page=3`);
  });

  it("sin pedidos, la pagina 5 redirige a la lista sin numero de pagina", async () => {
    const result = await openOrders({ status: "registrado", page: "5" }, 0);

    expect(result.outcome).toBe(`redirect:${ORDERS_ROUTE}?status=registrado`);
  });

  it("una pagina que existe se pinta sin redirigir", async () => {
    const result = await openOrders({ page: "3" }, 45);

    expect(result.outcome).toBe("render");
  });
});

// Toda lista paginada se cuida igual: una pagina que llama a getPaginationMeta llama tambien a
// redirectBeyondLastPage. Una lista nueva que lo olvide falla aqui.
describe("C3 del grupo de fixes: guardia de las listas paginadas", () => {
  const APP_DIR = join(process.cwd(), "src", "app");

  function pages(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        return pages(path);
      }

      return entry.name === "page.tsx" ? [path] : [];
    });
  }

  it("toda pagina con getPaginationMeta redirige cuando la pagina pedida no existe", () => {
    const paginated = pages(APP_DIR).filter((path) => readFileSync(path, "utf8").includes("getPaginationMeta("));
    const missing = paginated
      .filter((path) => !readFileSync(path, "utf8").includes("redirectBeyondLastPage("))
      .map((path) => relative(process.cwd(), path).replaceAll("\\", "/"));

    expect(paginated.length).toBeGreaterThanOrEqual(17);
    expect(missing).toEqual([]);
  });
});
