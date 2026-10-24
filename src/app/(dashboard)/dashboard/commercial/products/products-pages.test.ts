import { vi } from "vitest";

import {
  definePageSuite,
  generatedResult,
  generatedRow,
  type PrismaArgs,
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

// Caracterizacion de Productos (entrega 4.2), escrita antes de mover sus
// consultas a modules/commercial/products/queries.ts.
//
// Entrega 10.4a: casos que los datos generados nunca pintan, antes de llevar
// el formulario al panel lateral y la barra a FilterBar: la lista vacia, los
// filtros que coinciden con sus opciones (elegidas en la barra), el alta sin
// categorias activas y la edicion con su categoria y su unidad elegidas (la
// categoria actual se ofrece aunque este inactiva).

const CATEGORIES = [
  { nombre: "Estructuras metálicas", slug: "estructuras" },
  { nombre: "Herramientas agrícolas", slug: "herramientas" },
];

// La lista y las unidades salen de producto.findMany: las unidades piden
// distinct.
const productsWithUnits = (args: PrismaArgs) =>
  args?.distinct
    ? [{ unidad_medida: "docena" }, { unidad_medida: "unidad" }]
    : generatedResult("producto", "findMany", args);

const productToEdit = (args: PrismaArgs) => ({
  ...generatedRow("producto", "findUnique", args),
  categoria: "herramientas",
  unidad_medida: "docena",
  precio_referencial: "35.5",
  descripcion: "Mango de eucalipto.",
});

definePageSuite([
  {
    route: "/dashboard/commercial/products",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "filtros y vendedor",
        role: "SELLER",
        searchParams: {
          q: "reja",
          category: "estructuras",
          unit: "unidad",
          status: "active",
          page: "2",
        },
      },
      { name: "inactivos", searchParams: { status: "inactive" } },
      { name: "estado desconocido", searchParams: { status: "todos" } },
      {
        name: "sin productos registrados",
        data: { "producto.findMany": [], "producto.count": 0 },
      },
      {
        name: "filtros que coinciden con sus opciones",
        searchParams: { q: "lampa", category: "herramientas", unit: "docena", status: "inactive" },
        data: { "categoria_producto.findMany": CATEGORIES, "producto.findMany": productsWithUnits },
      },
    ],
  },
  {
    route: "/dashboard/commercial/products/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
      { name: "sin categorias activas", data: { "categoria_producto.findMany": [] } },
    ],
  },
  {
    route: "/dashboard/commercial/products/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "editar", params: { id: "PRO00000001" } },
      {
        name: "con su categoria y su unidad elegidas",
        params: { id: "PRO00000004" },
        data: { "producto.findUnique": productToEdit, "categoria_producto.findMany": CATEGORIES },
      },
      {
        name: "inexistente",
        params: { id: "PRO99999999" },
        data: { "producto.findUnique": null },
      },
    ],
  },
]);
