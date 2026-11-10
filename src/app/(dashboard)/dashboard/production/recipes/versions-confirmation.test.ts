import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { characterizePage, generatedRow, preloadPages } from "@/testing/page-characterization";

vi.mock("server-only", () => ({}));
// La confirmacion cerrada no pinta nada en el render de servidor: el doble la deja
// en linea para ver lo que la pagina le hace decir.
vi.mock("@/components/notifications/confirm-dialog", () => ({
  ConfirmDialog: ({ description }: { description: ReactNode }) => createElement("p", null, description),
}));
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

const versionRow = (id: string, numero_version: string, estado: string) => ({
  id_version_receta: id,
  numero_version,
  estado,
  fecha_version: new Date("2026-07-01T00:00:00.000Z"),
  motivo_cambio: null,
  usuario: null,
  detalle_receta: [],
  _count: { detalle_receta: 0, orden_trabajo: 0 },
});

const loadVersionsPage = () => import("./[id]/versions/page");

// B6: la confirmacion de marcar vigente nombra la version que queda reemplazada.
describe("confirmacion de marcar vigente", () => {
  // La carga de la pagina en frio va en un beforeAll, como en las demas suites
  // de paginas: dentro del caso contaba para su limite de 5 s y con la maquina
  // cargada lo superaba (hallazgo 42 de la 10.7b).
  preloadPages(loadVersionsPage);

  it("nombra la version vigente de la receta", async () => {
    const { html } = await characterizePage(
      loadVersionsPage,
      {
        name: "historial",
        params: { id: "REC00000001" },
        data: {
          "receta_tecnica.findUnique": (args) => ({
            ...(generatedRow("receta_tecnica", "findUnique", args) as Record<string, unknown>),
            estado: "activa",
            version_receta: [versionRow("VER00000002", "V2", "vigente"), versionRow("VER00000001", "V1", "reemplazada")],
          }),
        },
      },
      "/dashboard/production/recipes/REC00000001/versions",
    );

    expect(html).toContain("Las nuevas órdenes de trabajo usarán esta versión y la V2 quedará reemplazada.");
  });
});
