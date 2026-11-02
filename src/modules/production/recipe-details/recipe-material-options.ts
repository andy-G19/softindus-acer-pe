import { formatMoney } from "@/lib/formatters";
import { toNumber, type NumericInput } from "@/lib/numbers";

// Opciones de material de una linea de receta (10.6b, hallazgo 3 de la auditoria).
// La edicion suma el material actual aunque este inactivo, marcado como tal, igual
// que las opciones de edicion de pedidos: uno nuevo debe estar activo, y eso lo
// comprueba la accion. Funcion pura: la pagina le pasa lo que leyo su consulta.

type MaterialRow = {
  id_material: string;
  nombre_material: string;
  categoria: string;
  unidad_medida: string;
  stock_actual: NumericInput;
  costo_unitario_actual: NonNullable<NumericInput>;
  estado?: boolean;
};

export function buildRecipeMaterialOptions(materials: MaterialRow[]) {
  return materials.map((material) => ({
    id: material.id_material,
    label: material.nombre_material,
    description: `${material.categoria} - Stock: ${toNumber(material.stock_actual).toFixed(2)} ${material.unidad_medida} - ${formatMoney(
      material.costo_unitario_actual,
    )}${material.estado === false ? " - Inactivo" : ""}`,
    unidad_medida: material.unidad_medida,
  }));
}
