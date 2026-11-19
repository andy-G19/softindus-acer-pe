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
  // C5 de la 11.7d2: Produccion, Mantenimiento, Personal, Caja chica, Mermas, Usuarios y Auditoria.
  {
    name: "campañas",
    route: "/dashboard/production/campaigns",
    load: () => import("./production/campaigns/page"),
    model: "campania_produccion",
    filter: { q: "zzzz" },
    plain: "Todavía no hay campañas de producción registradas.",
    filtered: "No se encontraron campañas con los filtros aplicados.",
  },
  {
    name: "recetas",
    route: "/dashboard/production/recipes",
    load: () => import("./production/recipes/page"),
    model: "receta_tecnica",
    filter: { q: "zzzz" },
    plain: "Todavía no hay recetas técnicas registradas.",
    filtered: "No se encontraron recetas con los filtros aplicados.",
  },
  {
    name: "rutas",
    route: "/dashboard/production/routes",
    load: () => import("./production/routes/page"),
    model: "ruta_fabricacion",
    filter: { q: "zzzz" },
    plain: "Todavía no hay rutas de fabricación registradas.",
    filtered: "No se encontraron rutas con los filtros aplicados.",
  },
  {
    name: "ordenes de trabajo",
    route: "/dashboard/production/work-orders",
    load: () => import("./production/work-orders/page"),
    model: "orden_trabajo",
    filter: { q: "zzzz" },
    plain: "Todavía no hay órdenes de trabajo registradas.",
    filtered: "No se encontraron órdenes de trabajo con los filtros aplicados.",
  },
  {
    name: "maquinas",
    route: "/dashboard/maintenance/machines",
    load: () => import("./maintenance/machines/page"),
    model: "maquina",
    filter: { q: "zzzz" },
    plain: "Aun no hay maquinas registradas.",
    filtered: "No se encontraron máquinas con los filtros aplicados.",
  },
  {
    name: "repuestos",
    route: "/dashboard/maintenance/spare-parts",
    load: () => import("./maintenance/spare-parts/page"),
    model: "repuesto",
    filter: { q: "zzzz" },
    plain: "Aun no hay repuestos registrados.",
    filtered: "No se encontraron repuestos con los filtros aplicados.",
  },
  {
    name: "preventivos",
    route: "/dashboard/maintenance/preventive",
    load: () => import("./maintenance/preventive/page"),
    model: "mantenimiento_preventivo",
    filter: { q: "zzzz" },
    plain: "Aún no hay mantenimientos preventivos registrados.",
    filtered: "No se encontraron mantenimientos preventivos con los filtros aplicados.",
  },
  {
    name: "reparaciones",
    route: "/dashboard/maintenance/repairs",
    load: () => import("./maintenance/repairs/page"),
    model: "reparacion",
    filter: { q: "zzzz" },
    plain: "Aún no hay reparaciones registradas.",
    filtered: "No se encontraron reparaciones con los filtros aplicados.",
  },
  {
    name: "asistencias",
    route: "/dashboard/staff/attendance",
    load: () => import("./staff/attendance/page"),
    model: "asistencia",
    filter: { q: "zzzz" },
    plain: "Todavía no hay asistencias registradas.",
    filtered: "No se encontraron asistencias con los filtros aplicados.",
  },
  {
    name: "operarios",
    route: "/dashboard/staff/operators",
    load: () => import("./staff/operators/page"),
    model: "operario",
    filter: { q: "zzzz" },
    plain: "Todavía no hay operarios registrados.",
    filtered: "No se encontraron operarios con los filtros aplicados.",
  },
  {
    name: "planillas",
    route: "/dashboard/staff/payrolls",
    load: () => import("./staff/payrolls/page"),
    model: "planilla_pago",
    filter: { q: "zzzz" },
    plain: "Todavía no hay planillas generadas.",
    filtered: "No se encontraron planillas con los filtros aplicados.",
  },
  {
    name: "categorias de gasto",
    route: "/dashboard/petty-cash/categories",
    load: () => import("./petty-cash/categories/page"),
    model: "categoria_gasto",
    filter: { q: "zzzz" },
    plain: "Aún no hay categorías registradas.",
    filtered: "No se encontraron categorías con los filtros aplicados.",
  },
  {
    name: "movimientos de caja",
    route: "/dashboard/petty-cash/movements",
    load: () => import("./petty-cash/movements/page"),
    model: "movimiento_caja",
    filter: { q: "zzzz" },
    plain: "Aún no hay movimientos de caja registrados.",
    filtered: "No se encontraron movimientos con los filtros aplicados.",
  },
  {
    name: "retazos",
    route: "/dashboard/waste-scrap/reusable-scraps",
    load: () => import("./waste-scrap/reusable-scraps/page"),
    model: "retazo_reutilizable",
    filter: { q: "zzzz" },
    plain: "Aún no hay retazos registrados.",
    filtered: "No se encontraron retazos con los filtros seleccionados.",
  },
  {
    name: "chatarra",
    route: "/dashboard/waste-scrap/scraps",
    load: () => import("./waste-scrap/scraps/page"),
    model: "chatarra",
    filter: { q: "zzzz" },
    plain: "Aún no hay registros de chatarra.",
    filtered: "No se encontraron registros de chatarra con los filtros seleccionados.",
  },
  {
    name: "usuarios",
    route: "/dashboard/users",
    load: () => import("./users/page"),
    model: "usuario",
    filter: { q: "zzzz" },
    plain: "Todavía no hay usuarios registrados.",
    filtered: "No se encontraron usuarios con los filtros aplicados.",
  },
  {
    name: "auditoria",
    route: "/dashboard/audit",
    load: () => import("./audit/page"),
    model: "bitacora_operacion",
    filter: { q: "zzzz" },
    plain: "Todavía no hay operaciones registradas.",
    filtered: "No se encontraron operaciones con los filtros aplicados.",
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
