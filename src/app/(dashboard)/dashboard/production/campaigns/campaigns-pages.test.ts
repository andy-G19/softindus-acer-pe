import { vi } from "vitest";

import { definePageSuite, generatedRow } from "@/testing/page-characterization";

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

// Caracterizacion de Campanas de produccion (entrega 4.7), escrita antes
// de mover sus consultas a modules/production/campaigns/queries.ts.

// Campana sin detalles: la consulta de productos no excluye ninguno.
const campaignWithoutDetails = (args: Parameters<typeof generatedRow>[2]) => ({
  ...generatedRow("campania_produccion", "findUnique", args),
  campania_detalle: [],
});

// Una campana por estado: cada uno ofrece sus acciones de fila.
const campaignsIn =
  (...estados: string[]) =>
  (args: Parameters<typeof generatedRow>[2]) =>
    estados.map((estado, index) => ({
      ...generatedRow("campania_produccion", "findUnique", args),
      id_campania: `CAM0000000${index + 1}`,
      estado,
    }));

const campaignInState = (estado: string) => (args: Parameters<typeof generatedRow>[2]) => ({
  ...generatedRow("campania_produccion", "findUnique", args),
  estado,
});

definePageSuite([
  {
    route: "/dashboard/production/campaigns",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "lote",
          product: "PRO00000001",
          status: "activa",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      { name: "solo hasta", searchParams: { to: "2026-07-31" } },
      {
        name: "acciones de cada estado",
        data: {
          "campania_produccion.findMany": campaignsIn("planificada", "activa", "finalizada", "anulada"),
        },
      },
      { name: "sin campanas", data: { "campania_produccion.findMany": [] } },
    ],
  },
  {
    route: "/dashboard/production/campaigns/[id]",
    load: () => import("./[id]/page"),
    cases: [
      { name: "detalle", params: { id: "CAM00000001" } },
      {
        name: "finalizada no ofrece agregar producto",
        params: { id: "CAM00000001" },
        data: { "campania_produccion.findUnique": campaignInState("finalizada") },
      },
      {
        name: "inexistente",
        params: { id: "CAM99999999" },
        data: { "campania_produccion.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/campaigns/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "editar", params: { id: "CAM00000001" } },
      {
        name: "anulada queda bloqueada",
        params: { id: "CAM00000001" },
        data: { "campania_produccion.findUnique": campaignInState("anulada") },
      },
      {
        name: "inexistente",
        params: { id: "CAM99999999" },
        data: { "campania_produccion.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/campaigns/[id]/details/new",
    load: () => import("./[id]/details/new/page"),
    cases: [
      { name: "excluye productos ya agregados", params: { id: "CAM00000001" } },
      {
        name: "campana sin detalles",
        params: { id: "CAM00000002" },
        data: { "campania_produccion.findUnique": campaignWithoutDetails },
      },
      {
        name: "inexistente",
        params: { id: "CAM99999999" },
        data: { "campania_produccion.findUnique": null },
      },
    ],
  },
]);
