import type { MaterialFormValues } from "@/modules/inventory/materials/actions";

type EditableMaterial = {
  id_material: string;
  nombre_material: string;
  categoria: string;
  unidad_medida: string;
  stock_actual: unknown;
  stock_reservado: unknown;
  stock_minimo: unknown;
  costo_unitario_actual: unknown;
};

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

// Valores con los que el formulario abre la edicion de un material (entrega
// 10.3): los numeros con dos decimales. Los usan la pagina de edicion y su
// panel lateral, que muestran el mismo formulario.
export function getMaterialEditValues(
  material: EditableMaterial,
): MaterialFormValues & { id_material: string } {
  return {
    id_material: material.id_material,
    nombre_material: material.nombre_material,
    categoria: material.categoria,
    unidad_medida: material.unidad_medida,
    stock_actual: formatDecimal(material.stock_actual),
    stock_reservado: formatDecimal(material.stock_reservado),
    stock_minimo: formatDecimal(material.stock_minimo),
    costo_unitario_actual: formatDecimal(material.costo_unitario_actual),
  };
}
