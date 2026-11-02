// Opciones de producto de una ruta (10.6a, hallazgo 2 de la auditoria). El alta
// ofrece los activos; la edicion suma el producto actual aunque este inactivo,
// marcado como tal: sin el, el campo se veia vacio y guardar daba un error. Uno
// nuevo debe estar activo: lo comprueba la accion. Funcion pura, como las
// opciones de edicion de pedidos.

type ProductRow = {
  id_producto: string;
  nombre_producto: string;
  categoria: string;
  unidad_medida: string;
};

export function buildRouteProductOptions(products: ProductRow[], current?: ProductRow) {
  const toOption = (product: ProductRow, inactivo = false) => ({
    id: product.id_producto,
    label: product.nombre_producto,
    description: `${product.categoria} - ${product.unidad_medida}${inactivo ? " - Inactivo" : ""}`,
  });

  const options = products.map((product) => toOption(product));

  return current && !products.some((product) => product.id_producto === current.id_producto)
    ? [...options, toOption(current, true)]
    : options;
}
