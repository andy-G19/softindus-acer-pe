import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { characterizePage, generatedRow, preloadPages } from "@/testing/page-characterization";

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

// C4 de la 11.6a (D65, hallazgo 27 de la 10.6b): el detalle de la orden restaba el stock
// reservado del actual en number. Con 0.30 de stock y 0.10 reservado el disponible daba
// 0.19999999999999998: frente a un requerimiento de 0.20 la fila decia «Insuficiente» con un
// faltante de «0.00», y el resumen contaba el material como critico. Ahora disponible y faltante
// se calculan en centesimos, como guardan sus columnas numeric(10, 2). Una fila con stock de sobra
// muestra un faltante de 0.00 (nunca negativo) y una corta, el faltante exacto: el resumen cuenta
// solo esa.

const loadPage = () => import("./[id]/page");

preloadPages(loadPage);

type Args = Parameters<typeof generatedRow>[2];
type Row = Record<string, unknown>;

const D = (value: string) => new Prisma.Decimal(value);

/** Un material con ese stock actual y reservado. */
function material(base: Row, nombre: string, actual: string, reservado: string) {
  return { ...base, nombre_material: nombre, stock_actual: D(actual), stock_reservado: D(reservado) };
}

/** Las celdas de cada fila de la tabla de materiales (la quinta es el disponible, la sexta el faltante). */
function stockRows(html: string | null) {
  expect(html).not.toBeNull();

  return [...(html ?? "").matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
    .map(([, row]) => [...row.matchAll(/<td(?: [^>]*)?>([\s\S]*?)<\/td>/g)].map(([, cell]) => cell.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()))
    .filter((cells) => cells.some((cell) => cell === "Suficiente" || cell === "Insuficiente"));
}

// Nombre, stock actual, reservado, requerido, y lo que la fila debe mostrar: disponible, faltante
// y estado.
const materials = [
  ["Plancha justa", "0.30", "0.10", "0.20", "0.20", "0.00", "Suficiente"],
  ["Pernos justos", "1.15", "0.05", "1.10", "1.10", "0.00", "Suficiente"],
  ["Tubo sobrado", "5.00", "1.00", "2.50", "4.00", "0.00", "Suficiente"],
  ["Angulo corto", "0.30", "0.10", "0.25", "0.20", "0.05", "Insuficiente"],
] as const;

/** Por fila: nombre, disponible, faltante y estado, como los muestra la tabla. */
function shown(rows: string[][]) {
  return rows.map((cells) => [
    materials.find(([nombre]) => cells[0].includes(nombre))?.[0],
    cells[4].split(" ")[0],
    cells[5].split(" ")[0],
    cells.at(-1),
  ]);
}

const expected = materials.map(([nombre, , , , disponible, faltante, estado]) => [nombre, disponible, faltante, estado]);

describe("C4 de la 11.6a: disponible y faltante del detalle en centesimos", () => {
  it("con requerimiento congelado, el stock justo es suficiente y solo cuenta como critico el corto", async () => {
    const { html } = await characterizePage(
      loadPage,
      {
        name: "stock justo",
        params: { id: "OTR00000001" },
        data: {
          "orden_trabajo.findUnique": (args: Args) => {
            const row = generatedRow("orden_trabajo", "findUnique", args) as Row;
            const [first] = row.requerimiento_orden_material as Row[];

            return {
              ...row,
              requerimiento_orden_material: materials.map(([nombre, actual, reservado, requerida], index) => ({
                ...first,
                id_requerimiento: `ROM0000000${index + 1}`,
                cantidad_requerida: D(requerida),
                material: material(first.material as Row, nombre, actual, reservado),
              })),
            };
          },
        },
      },
      "/dashboard/production/work-orders/OTR00000001",
    );

    expect(shown(stockRows(html))).toEqual(expected);
    expect(html).toContain("Hay 1 material(es) sin stock suficiente");
  });

  it("una orden historica, desglosada desde la receta, tambien", async () => {
    const { html } = await characterizePage(
      loadPage,
      {
        name: "historica con stock justo",
        params: { id: "OTR00000001" },
        data: {
          "orden_trabajo.findUnique": (args: Args) => {
            const row = generatedRow("orden_trabajo", "findUnique", args) as Row;
            const version = row.version_receta as Row;
            const [first] = version.detalle_receta as Row[];

            return {
              ...row,
              cantidad: D("1.00"),
              requerimiento_orden_material: [],
              version_receta: {
                ...version,
                detalle_receta: materials.map(([nombre, actual, reservado, requerida], index) => ({
                  ...first,
                  id_detalle_receta: `DRE0000000${index + 1}`,
                  cantidad_requerida: D(requerida),
                  merma_estimada_porcentaje: null,
                  material: material(first.material as Row, nombre, actual, reservado),
                })),
              },
            };
          },
        },
      },
      "/dashboard/production/work-orders/OTR00000001",
    );

    expect(shown(stockRows(html))).toEqual(expected);
    expect(html).toContain("Hay 1 material(es) sin stock suficiente");
  });
});
