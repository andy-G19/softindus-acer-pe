import type { SparePartFormValues } from "@/modules/maintenance/spare-parts/actions";

type EditableSparePart = {
  id_repuesto: string;
  id_proveedor: string | null;
  nombre_repuesto: string;
  descripcion: string | null;
  costo_unitario: { toString(): string };
  estado: boolean;
};

// Valores con los que el formulario abre la edicion de un repuesto (entrega
// 10.5a): lo que falta, vacio. Los usan la pagina de edicion y su panel
// lateral, que muestran el mismo formulario.
export function getSparePartEditValues(
  sparePart: EditableSparePart,
): SparePartFormValues & { id_repuesto: string } {
  return {
    id_repuesto: sparePart.id_repuesto,
    id_proveedor: sparePart.id_proveedor ?? "",
    nombre_repuesto: sparePart.nombre_repuesto,
    descripcion: sparePart.descripcion ?? "",
    costo_unitario: sparePart.costo_unitario.toString(),
    estado: String(sparePart.estado),
  };
}
