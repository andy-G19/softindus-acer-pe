// Opciones de cliente y producto de la edicion de un pedido (10.4c, D3 de la
// 10.4a). La edicion ofrece los activos y, aunque esten inactivos, el cliente
// y los productos que el pedido ya tiene, marcados como tales: sin ellos, el
// campo visible quedaba vacio y obligatorio y el pedido no se podia guardar.
// Uno nuevo debe estar activo: lo comprueba la accion. Funcion pura: la pagina
// le pasa lo que leyo getOrderEditData.

type ClientRow = {
  id_cliente: string;
  nombre_razon_social: string;
  tipo_cliente: string;
};

type ProductRow = {
  id_producto: string;
  nombre_producto: string;
  categoria: string;
  unidad_medida: string;
  precio_referencial: { toString(): string } | null;
};

type EditedOrder = {
  cliente: ClientRow;
  detalle_pedido: { producto: ProductRow }[];
};

export function buildOrderEditOptions(order: EditedOrder, clients: ClientRow[], products: ProductRow[]) {
  const toClientOption = (client: ClientRow, inactivo: boolean) => ({
    id_cliente: client.id_cliente,
    nombre_razon_social: client.nombre_razon_social,
    tipo_cliente: client.tipo_cliente,
    ...(inactivo ? { inactivo } : {}),
  });
  const toProductOption = (product: ProductRow, inactivo: boolean) => ({
    id_producto: product.id_producto,
    nombre_producto: product.nombre_producto,
    categoria: product.categoria,
    unidad_medida: product.unidad_medida,
    precio_referencial: product.precio_referencial?.toString() ?? null,
    ...(inactivo ? { inactivo } : {}),
  });

  const currentClientListed = clients.some((client) => client.id_cliente === order.cliente.id_cliente);
  // Un pedido no repite producto (uq_detalle_pedido_producto): no hace falta
  // quitar duplicados.
  const inactiveProducts = order.detalle_pedido
    .map((detail) => detail.producto)
    .filter((product) => !products.some((active) => active.id_producto === product.id_producto));

  return {
    clients: [
      ...clients.map((client) => toClientOption(client, false)),
      ...(currentClientListed ? [] : [toClientOption(order.cliente, true)]),
    ],
    products: [
      ...products.map((product) => toProductOption(product, false)),
      ...inactiveProducts.map((product) => toProductOption(product, true)),
    ],
  };
}
