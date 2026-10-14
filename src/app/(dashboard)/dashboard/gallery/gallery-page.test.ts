import { describe, expect, it, vi } from "vitest";

import { GALLERY_SECTIONS } from "@/modules/gallery/gallery-layout";
import {
  AuthRejected,
  characterizePage,
  definePageSuite,
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
vi.mock("react-toastify", async () =>
  (await import("@/testing/notification-doubles")).toastifyModuleMock(),
);
vi.mock("sweetalert2", async () =>
  (await import("@/testing/notification-doubles")).sweetAlertModuleMock(),
);

// Galeria de componentes (entrega 8). Ademas de fijar su estructura con el
// arnes, exige el contrato que la hace segura en produccion: solo ADMIN, sin
// consultas a la base, sin acciones del servidor y sin enlaces a /api/ (en el
// build de produccion next/link hace prefetch de cada enlace visible).

const ROUTE = "/dashboard/gallery";
const loadGallery = () => import("./page");

definePageSuite([
  {
    route: ROUTE,
    load: loadGallery,
    cases: [{ name: "catalogo" }],
  },
]);

async function renderGallery() {
  const result = await characterizePage(loadGallery, { name: "contrato" }, ROUTE);

  return { calls: result.calls, html: result.html ?? "" };
}

describe("contrato de la galeria", () => {
  it("solo autoriza a ADMIN y no consulta la base", async () => {
    const { calls } = await renderGallery();

    expect(calls).toEqual([{ authz: "requireRole", roles: ["ADMIN"] }]);
  });

  it.each(["SELLER", "WORKSHOP_MASTER"] as const)("rechaza a %s", async (role) => {
    await expect(
      characterizePage(loadGallery, { name: "rechazo", role }, ROUTE),
    ).rejects.toBeInstanceOf(AuthRejected);
  });

  it("no enlaza a /api/ ni ejecuta acciones del servidor", async () => {
    const { html } = await renderGallery();
    const forms = html.match(/<form\b[^>]*>/g) ?? [];

    expect(html).not.toMatch(/href="\/api\//);
    // React escribe este action en un formulario cuya accion es una funcion.
    expect(html).not.toContain("javascript:throw");
    expect(forms.length).toBeGreaterThan(0);
    for (const form of forms) {
      expect(form).toMatch(/method="GET"/);
    }
  });

  it("cada entrada del indice lleva a su seccion", async () => {
    const { html } = await renderGallery();

    for (const { id } of GALLERY_SECTIONS) {
      expect(html).toContain(`href="#${id}"`);
      expect(html).toContain(`<section id="${id}"`);
    }
  });
});
