import type { MaterialFormValues } from "@/modules/inventory/materials/actions";
import { formatDecimal } from "@/lib/formatters";

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
    stock_actual: formatDecimal(material.stock_actual, { emptyText: "0.00" }),
    stock_reservado: formatDecimal(material.stock_reservado, { emptyText: "0.00" }),
    stock_minimo: formatDecimal(material.stock_minimo, { emptyText: "0.00" }),
    costo_unitario_actual: formatDecimal(material.costo_unitario_actual, { emptyText: "0.00" }),
  };
}
