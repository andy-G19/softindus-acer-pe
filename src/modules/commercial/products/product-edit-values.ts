import type { ProductFormValues } from "@/modules/commercial/products/actions";

type EditableProduct = {
  id_producto: string;
  nombre_producto: string;
  categoria: string;
  descripcion: string | null;
  unidad_medida: string;
  precio_referencial: { toString(): string } | null;
};

// Valores con los que el formulario abre la edicion de un producto (entrega
// 10.4a): lo que falta, vacio. Los usan la pagina de edicion y su panel
// lateral, que muestran el mismo formulario.
export function getProductEditValues(
  product: EditableProduct,
): ProductFormValues & { id_producto: string } {
  return {
    id_producto: product.id_producto,
    nombre_producto: product.nombre_producto,
    categoria: product.categoria,
    descripcion: product.descripcion ?? "",
    unidad_medida: product.unidad_medida,
    precio_referencial: product.precio_referencial?.toString() ?? "",
  };
}
