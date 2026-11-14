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

// Hallazgo de la verificacion de la 11.4b en staging: con el enlace de una chatarra que ya no se
// puede vender (vendida por otro, un listado desactualizado, el historial), el formulario no la
// tenia entre sus opciones y el navegador elegia la primera habilitada, otra chatarra, sin
// resumen y con el peso vacio. Enviarlo vendia esa otra chatarra entera. Ahora el campo queda en
// «Selecciona un registro de chatarra» y la pagina avisa que la del enlace ya no esta disponible.

const loadPage = () => import("./new/page");

preloadPages(loadPage);

const ROUTE = "/dashboard/waste-scrap/scrap-sales/new";

/** Las opciones del campo de la chatarra, con la marca de la que llega elegida. */
function scrapOptions(html: string | null) {
  expect(html).not.toBeNull();

  const select = /<select[^>]*name="id_chatarra"[^>]*>([\s\S]*?)<\/select>/.exec(html ?? "")?.[1] ?? "";

  return [...select.matchAll(/<option([^>]*)>([^<]*)<\/option>/g)].map(([, attributes, text]) => ({
    text,
    selected: attributes.includes("selected"),
  }));
}

describe("venta de una chatarra que ya no se puede vender", () => {
  it("el campo queda sin chatarra elegida y la pagina lo avisa", async () => {
    const { html } = await characterizePage(
      loadPage,
      { name: "no disponible", searchParams: { id_chatarra: "CHA00000099" } },
      ROUTE,
    );

    const selected = scrapOptions(html).filter((option) => option.selected);

    expect(selected.map((option) => option.text)).toEqual(["Selecciona un registro de chatarra"]);
    expect(html).toContain("La chatarra CHA00000099 ya no está disponible para la venta.");
  });

  it("una chatarra disponible sigue llegando elegida, sin aviso", async () => {
    const { html } = await characterizePage(
      loadPage,
      { name: "disponible", searchParams: { id_chatarra: "id_chatarra-1" } },
      ROUTE,
    );

    const selected = scrapOptions(html).filter((option) => option.selected);

    expect(selected.map((option) => option.text)).toEqual([
      "id_chatarra-1 | tipo_material-1 | Peso: 11.5 kg | Cantidad: 11.5",
    ]);
    expect(html).not.toContain("ya no está disponible");
  });
});
