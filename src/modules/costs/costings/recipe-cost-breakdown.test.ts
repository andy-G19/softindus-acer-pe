import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/formatters";
import { RecipeCostBreakdown } from "@/modules/costs/costings/recipe-cost-breakdown";

// H6 (grupo 2 de fixes): el desglose referencial del detalle de costeo
// convertia la receta con toNumber y la generacion del costeo
// (createCostingFromWorkOrderAction) con toNonNegativeNumber, sobre la misma
// formula. Solo difieren con un valor negativo, que la interfaz no deja
// ingresar pero la base no impide (no tiene CHECK): un seed, una importacion o
// el panel de Supabase. Con uno, el desglose mostraba un costo que no es el
// que se guarda. Ahora convierte como la generacion: un negativo vale 0.
//
// Cada caso pone un negativo en una de las cuatro entradas y espera la fila
// que corresponde a lo que guarda la generacion del costeo.

type WorkOrder = ComponentProps<typeof RecipeCostBreakdown>["workOrder"];

const D = (value: string) => new Prisma.Decimal(value);

function workOrder(changes: { cantidad?: string; requerida?: string; merma?: string; costo?: string }) {
  return {
    cantidad: D(changes.cantidad ?? "25.00"),
    version_receta: {
      detalle_receta: [
        {
          id_detalle_receta: "DRE00000001",
          cantidad_requerida: D(changes.requerida ?? "2.50"),
          merma_estimada_porcentaje: D(changes.merma ?? "10.00"),
          tipo_consumo: "materia_prima",
          unidad_medida: "kg",
          material: {
            nombre_material: "Plancha LAC 1/16",
            categoria: "Planchas",
            costo_unitario_actual: D(changes.costo ?? "12.47"),
          },
        },
      ],
    },
  } as unknown as WorkOrder;
}

// Texto de cada celda de la fila del material, sin la primera (nombre y
// categoria).
function rowCells(order: WorkOrder) {
  const html = renderToStaticMarkup(RecipeCostBreakdown({ workOrder: order }));
  const body = html.slice(html.indexOf("<tbody"));

  return [...body.matchAll(/<td[^>]*>(.*?)<\/td>/g)]
    .map((match) => match[1].replace(/<!-- -->/g, "").replace(/<[^>]+>/g, ""))
    .slice(1);
}

describe("RecipeCostBreakdown convierte la receta como la generacion del costeo (H6)", () => {
  it("sin negativos: la fila de referencia", () => {
    // 2.5 x 25 = 62.5; con 10 % de merma, 68.75; a 12.47, 857.3125.
    expect(rowCells(workOrder({}))).toEqual([
      "Material",
      "2.50 kg",
      "62.50 kg",
      "10.00%",
      "68.75 kg",
      formatMoney(12.47),
      formatMoney(857.3125),
    ]);
  });

  it("cantidad de la orden negativa: vale 0, como en la generacion", () => {
    expect(rowCells(workOrder({ cantidad: "-25.00" }))).toEqual([
      "Material",
      "2.50 kg",
      "0.00 kg",
      "10.00%",
      "0.00 kg",
      formatMoney(12.47),
      formatMoney(0),
    ]);
  });

  it("consumo por unidad negativo: vale 0", () => {
    expect(rowCells(workOrder({ requerida: "-2.50" }))).toEqual([
      "Material",
      "0.00 kg",
      "0.00 kg",
      "10.00%",
      "0.00 kg",
      formatMoney(12.47),
      formatMoney(0),
    ]);
  });

  it("merma negativa: vale 0 y el requerido total es el base", () => {
    // 62.5 a 12.47 = 779.375.
    expect(rowCells(workOrder({ merma: "-10.00" }))).toEqual([
      "Material",
      "2.50 kg",
      "62.50 kg",
      "0.00%",
      "62.50 kg",
      formatMoney(12.47),
      formatMoney(779.375),
    ]);
  });

  it("costo unitario negativo: vale 0", () => {
    expect(rowCells(workOrder({ costo: "-12.47" }))).toEqual([
      "Material",
      "2.50 kg",
      "62.50 kg",
      "10.00%",
      "68.75 kg",
      formatMoney(0),
      formatMoney(0),
    ]);
  });
});
