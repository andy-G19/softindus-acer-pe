import type { RecipeDetailFormValues } from "@/modules/production/recipe-details/actions";

// Valores con los que abre la edicion de una linea, en la pagina y en el panel.

type DetailRow = {
  id_detalle_receta: string;
  id_material: string;
  cantidad_requerida: { toString(): string };
  merma_estimada_porcentaje: { toString(): string } | null;
  tipo_consumo: string;
  observaciones: string | null;
};

function formatInputNumber(value: { toString(): string } | null) {
  return value === null ? "" : Number(value.toString()).toString();
}

export function getRecipeDetailEditValues(
  detail: DetailRow,
): RecipeDetailFormValues & { id_detalle_receta: string } {
  return {
    id_detalle_receta: detail.id_detalle_receta,
    id_material: detail.id_material,
    cantidad_requerida: formatInputNumber(detail.cantidad_requerida),
    merma_estimada_porcentaje: formatInputNumber(detail.merma_estimada_porcentaje),
    tipo_consumo: detail.tipo_consumo,
    observaciones: detail.observaciones ?? "",
  };
}
