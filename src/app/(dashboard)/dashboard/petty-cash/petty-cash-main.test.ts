import { describe, expect, it, vi } from "vitest";

import {
  characterizePage,
  preloadPages,
  type PageLoader,
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

// C4 de la 11.7b (D89): el shell del panel ya pinta el <main> de la pagina
// (dashboard-shell.tsx). Estas tres paginas abrian otro adentro: un lector de
// pantalla anuncia dos regiones principales y «ir al contenido» no sabe a cual ir,
// y HTML no permite un main dentro de otro. Su contenedor pasa a ser un <div>.

const pages: [string, PageLoader][] = [
  ["/dashboard/petty-cash", () => import("./page")],
  ["/dashboard/petty-cash/boxes", () => import("./boxes/page")],
  ["/dashboard/petty-cash/monthly-summary", () => import("./monthly-summary/page")],
];

preloadPages(...pages.map(([, load]) => load));

describe("C4 de la 11.7b: caja chica sin un main dentro del main del shell", () => {
  it.each(pages)("%s no abre otro main y conserva su titulo", async (route, load) => {
    const { outcome, html } = await characterizePage(load, { name: "main" }, route);

    expect(outcome).toBe("render");
    expect(html).not.toContain("<main");
    expect(html).toMatch(/<h1[ >]/);
  });
});
