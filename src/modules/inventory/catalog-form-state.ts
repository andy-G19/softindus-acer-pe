import { newOperationId, type FormActionState } from "@/lib/action-result";
import type { FieldErrors } from "@/lib/errors";

// Contrato de los catalogos de inventario (entrega 10): tipos de proveedor y
// categorias de material tienen el mismo formulario (nombre, slug y
// descripcion) y sus acciones devuelven el mismo resultado, que la ventana
// modal consume sin redireccion.

/** Lo que el formulario envio, tal cual, para volver a mostrarlo. */
export type InventoryCatalogFormValues = {
  nombre: string;
  slug: string;
  descripcion: string;
};

/** Resultado del alta y la edicion; con exito, el id del registro guardado. */
export type InventoryCatalogFormState = FormActionState<InventoryCatalogFormValues, { id: string }>;

export function getCatalogFormValues(formData: FormData): InventoryCatalogFormValues {
  return {
    nombre: formData.get("nombre")?.toString() ?? "",
    slug: formData.get("slug")?.toString() ?? "",
    descripcion: formData.get("descripcion")?.toString() ?? "",
  };
}

export function catalogError(
  values: InventoryCatalogFormValues,
  error: string,
  fieldErrors?: FieldErrors,
): InventoryCatalogFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

export function catalogSaved(values: InventoryCatalogFormValues, id: string): InventoryCatalogFormState {
  return { status: "success", data: { id }, values, operationId: newOperationId() };
}
