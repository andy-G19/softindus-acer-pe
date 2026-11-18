import { describe, expect, it, vi } from "vitest";

import { characterizePage, preloadPages, type PageLoader } from "@/testing/page-characterization";

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

// C4 y C5 de la 11.7d2 (D112, hallazgos 6 de la 10.3c y 22 de la 10.6a): un listado vacio decia
// «Todavia no hay … registrados» aunque el usuario hubiera filtrado (y clientes decia «con los
// filtros aplicados» aunque no hubiera ninguno). Ahora el texto depende de hasActiveFilters: sin
// filtros, el de siempre; con filtros, «No se encontraron … con los filtros aplicados».
// Cada caso vacia la consulta principal del listado (findMany y count) y pide la pagina dos veces.

type EmptyCase = {
  name: string;
  route: string;
  load: PageLoader;
  model: string;
  filter: Record<string, string>;
  plain: string;
  filtered: string;
};

const CASES: EmptyCase[] = [
  {
    name: "clientes",
    route: "/dashboard/commercial/clients",
    load: () => import("./commercial/clients/page"),
    model: "cliente",
    filter: { q: "zzzz" },
    plain: "Todavía no hay clientes registrados.",
    filtered: "No se encontraron clientes con los filtros aplicados.",
  },
  {
    name: "pedidos",
    route: "/dashboard/commercial/orders",
    load: () => import("./commercial/orders/page"),
    model: "pedido",
    filter: { status: "aprobado" },
    plain: "Todavía no hay pedidos registrados.",
    filtered: "No se encontraron pedidos con los filtros aplicados.",
  },
  {
    name: "pagos de cliente",
    route: "/dashboard/commercial/payments",
    load: () => import("./commercial/payments/page"),
    model: "pago_cliente",
    filter: { method: "yape" },
    plain: "Todavía no hay pagos registrados.",
    filtered: "No se encontraron pagos con los filtros aplicados.",
  },
  {
    name: "productos",
    route: "/dashboard/commercial/products",
    load: () => import("./commercial/products/page"),
    model: "producto",
    filter: { q: "zzzz" },
    plain: "Todavía no hay productos registrados.",
    filtered: "No se encontraron productos con los filtros aplicados.",
  },
  {
    name: "proformas",
    route: "/dashboard/commercial/quotes",
    load: () => import("./commercial/quotes/page"),
    model: "proforma",
    filter: { status: "vigente" },
    plain: "Todavía no hay proformas registradas.",
    filtered: "No se encontraron proformas con los filtros aplicados.",
  },
  {
    name: "comprobantes",
    route: "/dashboard/commercial/receipts",
    load: () => import("./commercial/receipts/page"),
    model: "comprobante_venta",
    filter: { type: "factura" },
    plain: "Todavía no hay comprobantes registrados.",
    filtered: "No se encontraron comprobantes con los filtros aplicados.",
  },
  {
    name: "entradas",
    route: "/dashboard/inventory/entries",
    load: () => import("./inventory/entries/page"),
    model: "movimiento_inventario",
    filter: { q: "zzzz" },
    plain: "Todavía no hay entradas registradas.",
    filtered: "No se encontraron entradas con los filtros aplicados.",
  },
  {
    name: "materiales",
    route: "/dashboard/inventory/materials",
    load: () => import("./inventory/materials/page"),
    model: "material",
    filter: { q: "zzzz" },
    plain: "Todavía no hay materiales registrados.",
    filtered: "No se encontraron materiales con los filtros aplicados.",
  },
  {
    name: "salidas",
    route: "/dashboard/inventory/outputs",
    load: () => import("./inventory/outputs/page"),
    model: "movimiento_inventario",
    filter: { q: "zzzz" },
    plain: "Todavía no hay salidas registradas.",
    filtered: "No se encontraron salidas con los filtros aplicados.",
  },
  {
    name: "compras",
    route: "/dashboard/inventory/purchases",
    load: () => import("./inventory/purchases/page"),
    model: "compra",
    filter: { status: "registrada" },
    plain: "Todavía no hay compras registradas.",
    filtered: "No se encontraron compras con los filtros aplicados.",
  },
  {
    name: "asociaciones proveedor-material",
    route: "/dashboard/inventory/supplier-materials",
    load: () => import("./inventory/supplier-materials/page"),
    model: "proveedor_material",
    filter: { status: "activo" },
    plain: "Todavía no hay asociaciones proveedor-material.",
    filtered: "No se encontraron asociaciones con los filtros aplicados.",
  },
  {
    name: "pagos a proveedores",
    route: "/dashboard/inventory/supplier-payments",
    load: () => import("./inventory/supplier-payments/page"),
    model: "pago_proveedor",
    filter: { method: "yape" },
    plain: "Todavía no hay pagos a proveedores.",
    filtered: "No se encontraron pagos a proveedores con los filtros aplicados.",
  },
  {
    name: "proveedores",
    route: "/dashboard/inventory/suppliers",
    load: () => import("./inventory/suppliers/page"),
    model: "proveedor",
    filter: { q: "zzzz" },
    plain: "Todavía no hay proveedores registrados.",
    filtered: "No se encontraron proveedores con los filtros aplicados.",
  },
  {
    name: "costeos",
    route: "/dashboard/costs/costings",
    load: () => import("./costs/costings/page"),
    model: "costeo",
    filter: { q: "zzzz" },
    plain: "Todavía no hay costeos registrados. Puedes generar uno desde una orden de trabajo.",
    filtered: "No se encontraron costeos con los filtros aplicados.",
  },
];

preloadPages(...CASES.map((item) => item.load));

async function emptyPage(item: EmptyCase, searchParams: Record<string, string>) {
  const { html } = await characterizePage(
    item.load,
    {
      name: item.name,
      searchParams,
      data: { [`${item.model}.findMany`]: [], [`${item.model}.count`]: 0 },
    },
    item.route,
  );

  return html ?? "";
}

describe("el vacio de un listado dice si hay filtros", () => {
  it.each(CASES.map((item) => [item.name, item] as const))("%s", async (_name, item) => {
    const sinFiltros = await emptyPage(item, {});
    const conFiltro = await emptyPage(item, item.filter);
    const conAviso = await emptyPage(item, { toast: "guardado", page: "2" });

    expect(sinFiltros).toContain(item.plain);
    expect(sinFiltros).not.toContain(item.filtered);
    expect(conFiltro).toContain(item.filtered);
    expect(conFiltro).not.toContain(item.plain);
    expect(conAviso, "el aviso y la pagina no son filtros").toContain(item.plain);
  });
});
