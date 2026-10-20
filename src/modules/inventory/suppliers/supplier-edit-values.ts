import type { SupplierFormValues } from "@/modules/inventory/suppliers/actions";

type EditableSupplier = {
  id_proveedor: string;
  razon_social: string;
  tipo_documento: string | null;
  numero_documento: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  contacto_principal: string | null;
  tipo_proveedor: string;
  condicion_pago: string | null;
  observaciones: string | null;
};

// Valores con los que el formulario abre la edicion de un proveedor (entrega
// 10.3b): lo que falta, vacio. Los usan la pagina de edicion y su panel
// lateral, que muestran el mismo formulario.
export function getSupplierEditValues(
  supplier: EditableSupplier,
): SupplierFormValues & { id_proveedor: string } {
  return {
    id_proveedor: supplier.id_proveedor,
    razon_social: supplier.razon_social,
    tipo_documento: supplier.tipo_documento ?? "",
    numero_documento: supplier.numero_documento ?? "",
    telefono: supplier.telefono ?? "",
    correo: supplier.correo ?? "",
    direccion: supplier.direccion ?? "",
    contacto_principal: supplier.contacto_principal ?? "",
    tipo_proveedor: supplier.tipo_proveedor,
    condicion_pago: supplier.condicion_pago ?? "",
    observaciones: supplier.observaciones ?? "",
  };
}
