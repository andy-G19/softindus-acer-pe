import { describe, expect, it, vi } from "vitest";

import { characterizePage, generatedResult, preloadPages, type PrismaArgs } from "@/testing/page-characterization";

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

// C5 de la 11.3c (D40, hallazgo 5 de la 10.4b): el detalle de proforma siempre decia «Volver a
// proformas» y su miga de pan llevaba a proformas sin filtros, aunque se llegara desde pagos,
// comprobantes o pedidos filtrados. Ahora cada listado que lo abre le pasa su URL (filtros y
// pagina) en `returnTo`, y el detalle acepta solo esos cuatro origenes: cualquier otro, o ninguno,
// vuelve a proformas como antes.
//
// `BackButton` vuelve con el historial cuando puede y usa su destino de respaldo al abrir el
// detalle en otra pestana o tras recargar; el respaldo es el mismo `backHref` que la miga de pan,
// asi que la prueba lo comprueba por la miga.

const loadDetail = () => import("./[id]/page");
const loadQuotes = () => import("./page");
const loadPayments = () => import("../payments/page");
const loadReceipts = () => import("../receipts/page");
const loadOrders = () => import("../orders/page");

preloadPages(loadDetail, loadQuotes, loadPayments, loadReceipts, loadOrders);

const DETAIL_ROUTE = "/dashboard/commercial/quotes/PRF00000001";

async function renderDetail(returnTo?: string) {
  const { html } = await characterizePage(
    loadDetail,
    {
      name: "detalle",
      params: { id: "PRF00000001" },
      searchParams: returnTo === undefined ? {} : { returnTo },
    },
    DETAIL_ROUTE,
  );

  expect(html).not.toBeNull();
  return html ?? "";
}

/** El `href` de un atributo HTML tal como lo escribe React (`&` como `&amp;`). */
function htmlHref(href: string) {
  return href.replaceAll("&", "&amp;");
}

describe("C5 de la 11.3c: el detalle de proforma vuelve a su listado de origen", () => {
  it.each([
    ["pagos de cliente", "/dashboard/commercial/payments?method=yape&page=2", "Pagos de cliente", "Volver a pagos de cliente"],
    ["comprobantes", "/dashboard/commercial/receipts?status=emitido", "Comprobantes de venta", "Volver a comprobantes"],
    ["pedidos", "/dashboard/commercial/orders?status=aprobado&page=3", "Pedidos", "Volver a pedidos"],
    ["proformas filtradas", "/dashboard/commercial/quotes?balance=pending&page=2", "Proformas", "Volver a proformas"],
  ])("desde %s: la miga y «Volver» nombran el listado y llevan a su URL", async (_origin, returnTo, crumb, back) => {
    const html = await renderDetail(returnTo);

    expect(html).toContain(`<a href="${htmlHref(returnTo)}">${crumb}</a>`);
    expect(html).toContain(`<button type="button" aria-label="${back}">`);
  });

  it.each([
    ["sin returnTo", undefined],
    ["un returnTo externo", "https://example.com/dashboard/commercial/payments"],
    ["un returnTo de otro modulo", "/dashboard/inventory/purchases?status=pagada"],
    ["una ruta que solo empieza como un listado", "/dashboard/commercial/payments-old?x=1"],
  ])("con %s vuelve a proformas, como antes", async (_case, returnTo) => {
    const html = await renderDetail(returnTo);

    expect(html).toContain('<a href="/dashboard/commercial/quotes">Proformas</a>');
    expect(html).toContain('<button type="button" aria-label="Volver a proformas">');
    expect(html).not.toContain("Pagos de cliente</a>");
    expect(html).not.toContain("inventory/purchases");
  });
});

describe("C5 de la 11.3c: los listados pasan su URL al detalle de proforma", () => {
  it.each([
    ["proformas", loadQuotes, "/dashboard/commercial/quotes", { status: "vigente", page: "2" }],
    ["pagos de cliente", loadPayments, "/dashboard/commercial/payments", { method: "yape", page: "2" }],
    ["comprobantes", loadReceipts, "/dashboard/commercial/receipts", { status: "emitido" }],
    ["pedidos", loadOrders, "/dashboard/commercial/orders", { status: "aprobado", page: "3" }],
  ] as const)("%s: cada enlace al detalle lleva returnTo con sus filtros", async (_list, load, route, searchParams) => {
    const { html } = await characterizePage(load, { name: "enlaces", searchParams: { ...searchParams } }, route);
    const listUrl = `${route}?${new URLSearchParams(searchParams).toString()}`;
    const detailLinks = [...(html ?? "").matchAll(/href="(\/dashboard\/commercial\/quotes\/(?!new)[^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(detailLinks.length).toBeGreaterThan(0);
    for (const href of detailLinks) {
      expect(href).toMatch(new RegExp(`\\?returnTo=${encodeURIComponent(listUrl).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    }
  });
});

// C5 de la 11.7d (D107, hallazgo 5 de la 11.3c): el detalle de pedido y el reporte de ventas y
// cobranzas enlazaban a la proforma sin `returnTo`, y «Volver» llevaba a proformas. «Generar
// proforma» del listado de pedidos abria el alta sin el listado, y al guardar volvia a proformas.
// Ahora el detalle de proforma acepta tambien el detalle de un pedido (`PED` y 8 cifras, sin
// subrutas) y el reporte (su ruta exacta), cada uno con su miga y su «Volver».
const loadOrderDetail = () => import("../orders/[id]/page");
const loadSalesReport = () => import("../../reports/sales-collections/page");

preloadPages(loadOrderDetail, loadSalesReport);

describe("C5 de la 11.7d: el detalle de proforma vuelve al pedido y al reporte", () => {
  it("desde el detalle de un pedido: la miga lleva al pedido y a su listado, y «Volver al pedido»", async () => {
    const orders = "/dashboard/commercial/orders?status=aprobado";
    const order = `/dashboard/commercial/orders/PED00000001?returnTo=${encodeURIComponent(orders)}`;
    const html = await renderDetail(order);

    expect(html).toContain(`<a href="${htmlHref(orders)}">Pedidos</a>`);
    expect(html).toContain(`<a href="${htmlHref(order)}">PED00000001</a>`);
    expect(html).toContain('<button type="button" aria-label="Volver al pedido">');
  });

  it("desde el reporte de ventas y cobranzas: la miga lleva al reporte con sus filtros", async () => {
    const report = "/dashboard/reports/sales-collections?orderStatus=aprobado&collectionStatus=pendiente";
    const html = await renderDetail(report);

    expect(html).toContain('<a href="/dashboard/reports">Reportes</a>');
    expect(html).toContain(`<a href="${htmlHref(report)}">Ventas y cobranzas</a>`);
    expect(html).toContain('<button type="button" aria-label="Volver al reporte">');
  });

  it.each([
    ["una subruta del pedido", "/dashboard/commercial/orders/PED00000001/edit"],
    ["un id que no es de pedido", "/dashboard/commercial/orders/new"],
    ["una ruta que solo empieza como el reporte", "/dashboard/reports/sales-collections-old"],
  ])("con %s vuelve a proformas", async (_case, returnTo) => {
    const html = await renderDetail(returnTo);

    expect(html).toContain('<a href="/dashboard/commercial/quotes">Proformas</a>');
    expect(html).toContain('<button type="button" aria-label="Volver a proformas">');
  });

  it("el detalle de pedido pasa su URL, con su propio returnTo, a cada proforma", async () => {
    const orders = "/dashboard/commercial/orders?status=aprobado";
    const { html } = await characterizePage(
      loadOrderDetail,
      { name: "pedido", params: { id: "PED00000001" }, searchParams: { returnTo: orders } },
      "/dashboard/commercial/orders/PED00000001",
    );
    const order = `/dashboard/commercial/orders/PED00000001?returnTo=${encodeURIComponent(orders)}`;
    const links = [...(html ?? "").matchAll(/href="(\/dashboard\/commercial\/quotes\/[^"]+)"/g)].map((m) => m[1]);

    expect(links.length).toBeGreaterThan(0);
    for (const href of links) {
      expect(href.replaceAll("&amp;", "&")).toMatch(/\?returnTo=/);
      expect(decodeURIComponent(href.replaceAll("&amp;", "&").split("?returnTo=")[1])).toBe(order);
    }
  });

  it("el reporte pasa su URL con los filtros a cada proforma", async () => {
    // Filtros que van a la consulta (el doble no los aplica): el estado de cobranza se filtra en
    // memoria y dejaria sin filas a los datos generados.
    const searchParams = { orderStatus: "aprobado", searchCode: "PED" };
    const { html } = await characterizePage(
      loadSalesReport,
      { name: "reporte", searchParams: { ...searchParams } },
      "/dashboard/reports/sales-collections",
    );
    const report = `/dashboard/reports/sales-collections?${new URLSearchParams(searchParams).toString()}`;
    const links = [...(html ?? "").matchAll(/href="(\/dashboard\/commercial\/quotes\/[^"]+)"/g)].map((m) => m[1]);

    expect(links.length).toBeGreaterThan(0);
    for (const href of links) {
      expect(decodeURIComponent(href.replaceAll("&amp;", "&").split("?returnTo=")[1] ?? "")).toBe(report);
    }
  });

  it("«Generar proforma» del listado de pedidos lleva returnTo con el listado", async () => {
    const searchParams = { status: "aprobado", page: "3" };
    // Un pedido registrado y sin proforma: el unico caso en que se ofrece generarla.
    const sinProforma = (args: PrismaArgs) =>
      (generatedResult("pedido", "findMany", args) as Record<string, unknown>[]).map((order) => ({
        ...order,
        estado: "registrado",
        proforma: [],
      }));
    const { html } = await characterizePage(
      loadOrders,
      { name: "generar", searchParams: { ...searchParams }, data: { "pedido.findMany": sinProforma } },
      "/dashboard/commercial/orders",
    );
    const list = `/dashboard/commercial/orders?${new URLSearchParams(searchParams).toString()}`;
    const links = [...(html ?? "").matchAll(/href="(\/dashboard\/commercial\/quotes\/new\?orderId=[^"]+)"/g)].map(
      (m) => m[1].replaceAll("&amp;", "&"),
    );

    expect(links.length).toBeGreaterThan(0);
    for (const href of links) {
      expect(new URL(href, "https://x.invalid").searchParams.get("returnTo")).toBe(list);
    }
  });
});

// C5 de la 11.7d (D107): el alta de proforma ya no siempre viene de proformas. Su miga y su
// «Volver» nombran el listado al que llevan: pedidos o proformas. Otra ruta vuelve a proformas,
// como el detalle (D40), en lugar de llamar «Proformas» a un enlace que lleva a otro sitio.
const loadNew = () => import("./new/page");

preloadPages(loadNew);

describe("C5 de la 11.7d: el alta de proforma nombra el listado al que vuelve", () => {
  async function renderNew(returnTo?: string) {
    const { html } = await characterizePage(
      loadNew,
      { name: "alta", searchParams: returnTo === undefined ? {} : { returnTo } },
      "/dashboard/commercial/quotes/new",
    );

    return html ?? "";
  }

  it("desde pedidos filtrados: «Pedidos» y «Volver a pedidos» llevan a ese listado", async () => {
    const orders = "/dashboard/commercial/orders?status=aprobado&page=3";
    const html = await renderNew(orders);

    expect(html).toContain(`<a href="${htmlHref(orders)}">Pedidos</a>`);
    expect(html).toContain('<button type="button" aria-label="Volver a pedidos">');
  });

  it("desde proformas filtradas sigue como antes", async () => {
    const quotes = "/dashboard/commercial/quotes?status=vigente";
    const html = await renderNew(quotes);

    expect(html).toContain(`<a href="${htmlHref(quotes)}">Proformas</a>`);
    expect(html).toContain('<button type="button" aria-label="Volver a proformas">');
  });

  it("desde otra ruta vuelve a proformas sin filtros", async () => {
    const html = await renderNew("/dashboard/inventory/purchases?status=pagada");

    expect(html).toContain('<a href="/dashboard/commercial/quotes">Proformas</a>');
    expect(html).not.toContain("inventory/purchases");
  });
});
