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
