// Opciones de proveedor del formulario de repuestos (D2 de la 10.5a, hallazgo
// 4 de la 10.3a). La edicion lee los activos y, aunque este inactivo, el
// proveedor actual del repuesto (getSparePartEditData): sin el, el campo
// quedaba vacio y guardar lo quitaba. Se marca como «Inactivo» en la
// descripcion de la opcion. El alta solo lee activos y no trae el estado. Uno
// nuevo debe estar activo: lo comprueba la accion. Funcion pura.

type ProviderRow = {
  id_proveedor: string;
  razon_social: string;
  estado?: boolean;
};

export function buildSparePartProviderOptions(providers: ProviderRow[]) {
  return providers.map((provider) => ({
    id: provider.id_proveedor,
    label: provider.razon_social,
    ...(provider.estado === false ? { description: "Inactivo" } : {}),
  }));
}
