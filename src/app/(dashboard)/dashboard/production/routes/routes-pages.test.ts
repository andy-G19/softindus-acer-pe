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

// Caracterizacion de Rutas de fabricacion (entrega 4.7), escrita antes
// de mover sus consultas a modules/production/routes/queries.ts.

// Etapa sin maquina asignada: las opciones de maquina no agregan la actual.
const stageWithoutMachine = (args: Parameters<typeof generatedRow>[2]) => ({
  ...generatedRow("etapa_ruta", "findFirst", args),
  etapa_ruta_maquina: [],
});

definePageSuite([
  {
    route: "/dashboard/production/routes",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: { q: "corte", product: "PRO00000001", status: "active" },
      },
      { name: "inactivas", searchParams: { status: "inactive" } },
    ],
  },
  {
    route: "/dashboard/production/routes/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
  {
    route: "/dashboard/production/routes/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "editar", params: { id: "RUT00000001" } },
      {
        name: "inexistente",
        params: { id: "RUT99999999" },
        data: { "ruta_fabricacion.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/routes/[id]/stages",
    load: () => import("./[id]/stages/page"),
    cases: [
      { name: "etapas", params: { id: "RUT00000001" } },
      {
        name: "filtros con maquina y activas",
        params: { id: "RUT00000001" },
        searchParams: { q: "soldadura", requiresMachine: "yes", status: "active" },
      },
      {
        name: "sin maquina e inactivas",
        params: { id: "RUT00000001" },
        searchParams: { requiresMachine: "no", status: "inactive" },
      },
      {
        name: "inexistente",
        params: { id: "RUT99999999" },
        data: { "ruta_fabricacion.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/routes/[id]/stages/new",
    load: () => import("./[id]/stages/new/page"),
    cases: [
      { name: "nueva etapa", params: { id: "RUT00000001" } },
      {
        name: "inexistente",
        params: { id: "RUT99999999" },
        data: { "ruta_fabricacion.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/routes/[id]/stages/[stageId]/edit",
    load: () => import("./[id]/stages/[stageId]/edit/page"),
    cases: [
      { name: "editar con maquina", params: { id: "RUT00000001", stageId: "ETR00000001" } },
      {
        name: "editar sin maquina",
        params: { id: "RUT00000001", stageId: "ETR00000002" },
        data: { "etapa_ruta.findFirst": stageWithoutMachine },
      },
      {
        name: "inexistente",
        params: { id: "RUT00000001", stageId: "ETR99999999" },
        data: { "etapa_ruta.findFirst": null },
      },
    ],
  },
]);
