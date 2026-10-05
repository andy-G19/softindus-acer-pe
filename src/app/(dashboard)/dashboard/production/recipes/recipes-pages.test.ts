import { vi } from "vitest";

import { definePageSuite } from "@/testing/page-characterization";

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

// Caracterizacion de Recetas tecnicas (entrega 4.7), escrita antes
// de mover sus consultas a modules/production/recipes/queries.ts.

definePageSuite([
  {
    route: "/dashboard/production/recipes",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: { q: "reja", product: "PRO00000001", status: "activa" },
      },
    ],
  },
  {
    route: "/dashboard/production/recipes/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
  {
    route: "/dashboard/production/recipes/[id]/versions",
    load: () => import("./[id]/versions/page"),
    cases: [
      { name: "versiones", params: { id: "REC00000001" } },
      {
        name: "inexistente",
        params: { id: "REC99999999" },
        data: { "receta_tecnica.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/recipes/[id]/versions/new",
    load: () => import("./[id]/versions/new/page"),
    cases: [
      { name: "nueva version", params: { id: "REC00000001" } },
      {
        name: "inexistente",
        params: { id: "REC99999999" },
        data: { "receta_tecnica.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/recipes/[id]/versions/[versionId]/details",
    load: () => import("./[id]/versions/[versionId]/details/page"),
    cases: [
      { name: "detalle de version", params: { id: "REC00000001", versionId: "VER00000001" } },
      {
        name: "inexistente",
        params: { id: "REC00000001", versionId: "VER99999999" },
        data: { "version_receta.findFirst": null },
      },
    ],
  },
  {
    route: "/dashboard/production/recipes/[id]/versions/[versionId]/details/new",
    load: () => import("./[id]/versions/[versionId]/details/new/page"),
    cases: [
      { name: "nuevo detalle", params: { id: "REC00000001", versionId: "VER00000001" } },
      {
        name: "inexistente",
        params: { id: "REC00000001", versionId: "VER99999999" },
        data: { "version_receta.findFirst": null },
      },
    ],
  },
  {
    route: "/dashboard/production/recipes/[id]/versions/[versionId]/details/[detailId]/edit",
    load: () => import("./[id]/versions/[versionId]/details/[detailId]/edit/page"),
    cases: [
      {
        name: "editar detalle de la receta",
        params: { id: "id_receta-1", versionId: "VER00000001", detailId: "DRE00000001" },
      },
      {
        name: "detalle de otra receta",
        params: { id: "REC00000002", versionId: "VER00000001", detailId: "DRE00000001" },
      },
      {
        name: "inexistente",
        params: { id: "id_receta-1", versionId: "VER00000001", detailId: "DRE99999999" },
        data: { "detalle_receta.findFirst": null },
      },
    ],
  },
  {
    route: "/dashboard/production/recipes/[id]/versions/[versionId]/requirements",
    load: () => import("./[id]/versions/[versionId]/requirements/page"),
    cases: [
      { name: "una unidad", params: { id: "REC00000001", versionId: "VER00000001" } },
      {
        name: "cantidad elegida",
        params: { id: "REC00000001", versionId: "VER00000001" },
        searchParams: { quantity: "25" },
      },
      {
        name: "cantidad invalida",
        params: { id: "REC00000001", versionId: "VER00000001" },
        searchParams: { quantity: "abc" },
      },
      {
        name: "inexistente",
        params: { id: "REC00000001", versionId: "VER99999999" },
        data: { "version_receta.findFirst": null },
      },
    ],
  },
]);
