import type { SupplierMaterialFormValues } from "@/modules/inventory/supplier-materials/actions";

type SupplierOption = { id_proveedor: string; razon_social: string };
type MaterialOption = { id_material: string; nombre_material: string; unidad_medida: string };

type EditableRelation = {
  id_proveedor_material: string;
  id_proveedor: string;
  id_material: string;
  unidad_medida: string;
  precio_referencial: { toString(): string } | null;
  tiempo_entrega_dias: number | null;
  disponibilidad: string | null;
};

// Opciones de proveedor y material del formulario de asociaciones (entrega
// 10.3b): el material lleva su unidad. Las usan las paginas de alta y edicion
// y sus paneles laterales, que muestran el mismo formulario.
export function getSupplierMaterialOptions(suppliers: SupplierOption[], materials: MaterialOption[]) {
  return {
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id_proveedor,
      label: supplier.razon_social,
    })),
    materials: materials.map((material) => ({
      id: material.id_material,
      label: `${material.nombre_material} (${material.unidad_medida})`,
    })),
  };
}

// Valores con los que el formulario abre la edicion de una asociacion: lo que
// falta, vacio.
export function getSupplierMaterialEditValues(
  relation: EditableRelation,
): SupplierMaterialFormValues & { id_proveedor_material: string } {
  return {
    id_proveedor_material: relation.id_proveedor_material,
    id_proveedor: relation.id_proveedor,
    id_material: relation.id_material,
    unidad_medida: relation.unidad_medida,
    precio_referencial: relation.precio_referencial?.toString() ?? "",
    tiempo_entrega_dias: relation.tiempo_entrega_dias?.toString() ?? "",
    disponibilidad: relation.disponibilidad ?? "",
  };
}
