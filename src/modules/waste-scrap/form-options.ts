// Opciones de los selectores de Mermas: las mismas en el panel y en la pagina completa
// de chatarra y de retazos.

export function buildMaterialItems(
  materials: {
    id_material: string;
    nombre_material: string;
    categoria: string;
    stock_actual: { toString(): string };
    unidad_medida: string;
  }[],
) {
  return materials.map((material) => ({
    id: material.id_material,
    label: material.nombre_material,
    description: `${material.categoria} - Stock: ${material.stock_actual.toString()} ${material.unidad_medida}`,
  }));
}

export function buildWorkOrderItems(
  workOrders: {
    id_orden_trabajo: string;
    estado: string;
    producto: { nombre_producto: string };
    cliente: { nombre_razon_social: string } | null;
  }[],
) {
  return workOrders.map((order) => ({
    id: order.id_orden_trabajo,
    label: `${order.id_orden_trabajo} - ${order.producto.nombre_producto}`,
    description: order.cliente ? `${order.estado} - ${order.cliente.nombre_razon_social}` : order.estado,
  }));
}
