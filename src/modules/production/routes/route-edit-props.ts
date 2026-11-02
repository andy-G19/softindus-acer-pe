import { buildRouteProductOptions } from "@/modules/production/routes/route-product-options";

type ProductRow = Parameters<typeof buildRouteProductOptions>[0][number];

type EditedRoute = {
  id_ruta: string;
  id_producto: string;
  nombre_ruta: string;
  descripcion: string | null;
  producto: ProductRow;
  _count: { orden_trabajo: number };
};

// Lo que la pagina y el panel de edicion pasan a RouteForm: los dos leen la misma
// consulta y deben mostrar lo mismo. Funcion pura.
export function getRouteEditFormProps(route: EditedRoute, products: ProductRow[]) {
  return {
    products: buildRouteProductOptions(products, route.producto),
    defaultValues: {
      id_ruta: route.id_ruta,
      id_producto: route.id_producto,
      nombre_ruta: route.nombre_ruta,
      descripcion: route.descripcion ?? "",
    },
    lockedProductName: route._count.orden_trabajo > 0 ? route.producto.nombre_producto : undefined,
  };
}
