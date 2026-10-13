import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  characterizePage,
  preloadPages,
  type PageLoader,
} from "@/testing/page-characterization";

// Enlaces de exportacion de las pantallas de reportes (grupo 4 de fixes). En
// el build de produccion, next/link hace prefetch de cada <Link> visible con
// un GET a su URL. Si la URL es la ruta de exportacion, ese GET ejecuta la
// exportacion: la registra en exportacion_datos y en la bitacora y genera el
// archivo sin que nadie la pida. Por eso un enlace a /api/ va en un <a>.
// El HTML de un <Link> y de un <a> es el mismo; el doble de next/link marca
// los suyos para distinguirlos.

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
vi.mock("next/link", () => ({
  default: (props: { href: unknown; children?: ReactNode } & Record<string, unknown>) => {
    const { href, children, ...rest } = props;

    delete rest.prefetch;

    return createElement(
      "a",
      { ...rest, href: String(href), "data-next-link": "true" },
      children,
    );
  },
}));

const REPORT_PAGES: [string, PageLoader][] = [
  ["/dashboard/reports/production", () => import("./production/page")],
  ["/dashboard/reports/inventory", () => import("./inventory/page")],
  ["/dashboard/reports/sales-collections", () => import("./sales-collections/page")],
  ["/dashboard/reports/suppliers-purchases", () => import("./suppliers-purchases/page")],
  ["/dashboard/reports/financial", () => import("./financial/page")],
  ["/dashboard/reports/maintenance", () => import("./maintenance/page")],
  ["/dashboard/reports/profitability", () => import("./profitability/page")],
  ["/dashboard/reports/staff", () => import("./staff/page")],
  ["/dashboard/audit", () => import("../audit/page")],
];

describe("enlaces de exportacion de las pantallas de reportes", () => {
  preloadPages(...REPORT_PAGES.map(([, load]) => load));

  for (const [route, load] of REPORT_PAGES) {
    it(`${route}: exporta con un <a> que next/link no prefetchea`, async () => {
      const { html } = await characterizePage(load, { name: route }, route);
      const exportLinks = [...(html ?? "").matchAll(/<a\b[^>]*>/g)]
        .map((match) => match[0])
        .filter((anchor) => anchor.includes('href="/api/'));

      expect(exportLinks.length).toBeGreaterThanOrEqual(2);
      expect(exportLinks.filter((anchor) => anchor.includes("data-next-link"))).toEqual([]);
    });
  }
});
