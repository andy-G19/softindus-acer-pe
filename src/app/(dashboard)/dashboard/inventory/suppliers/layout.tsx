// Proveedores con panel lateral (entrega 10.3b), como Clientes y Materiales:
// la ranura @panel recibe el alta y la edicion interceptadas ((.)new y
// (.)[id]/edit) cuando se abren desde el listado, y muestra el panel encima de
// la lista sin perder sus filtros ni su desplazamiento. Una recarga o la URL
// directa no interceptan: renderizan new/ o [id]/edit/ a pagina completa y la
// ranura queda en default.tsx (nada).
export default function SuppliersLayout({ children, panel }: LayoutProps<"/dashboard/inventory/suppliers">) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}
