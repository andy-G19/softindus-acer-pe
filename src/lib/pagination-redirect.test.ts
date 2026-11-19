import { describe, expect, it, vi } from "vitest";

import { getPaginationMeta } from "@/lib/pagination";
import { lastPageHref, redirectBeyondLastPage } from "@/lib/pagination-redirect";

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const BASE = "/dashboard/commercial/orders";

// C3 del grupo de fixes (D126): la pagina posterior a la ultima lleva a la ultima.
describe("redirectBeyondLastPage", () => {
  it("redirige a la ultima pagina conservando los filtros y quitando la pagina pedida", () => {
    const meta = getPaginationMeta({ totalItems: 45, page: 99, pageSize: 20 });

    redirectBeyondLastPage({ page: 99, meta, basePath: BASE, searchParams: { status: "registrado", page: "99" } });

    expect(mocks.redirect).toHaveBeenCalledWith(`${BASE}?status=registrado&page=3`);
  });

  it("si la ultima es la primera, redirige sin numero de pagina", () => {
    const meta = getPaginationMeta({ totalItems: 0, page: 4, pageSize: 20 });

    expect(lastPageHref(meta, BASE, { page: "4" })).toBe(BASE);
    expect(lastPageHref(meta, BASE, { q: "perno", page: "4" })).toBe(`${BASE}?q=perno`);
  });

  it("conserva el tamano de pagina pedido", () => {
    const meta = getPaginationMeta({ totalItems: 12, page: 9, pageSize: 5 });

    expect(lastPageHref(meta, BASE, { pageSize: "5", page: "9" })).toBe(`${BASE}?pageSize=5&page=3`);
  });

  it("no redirige en la ultima pagina ni en una anterior", () => {
    mocks.redirect.mockClear();

    for (const page of [1, 2, 3]) {
      redirectBeyondLastPage({
        page,
        meta: getPaginationMeta({ totalItems: 45, page, pageSize: 20 }),
        basePath: BASE,
        searchParams: { page: String(page) },
      });
    }

    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
