// Materiales con panel lateral (entrega 10.3), como Clientes: la ranura @panel
// recibe el alta y la edicion interceptadas ((.)new y (.)[id]/edit) cuando se
// abren desde el listado, y muestra el panel encima de la lista sin perder sus
// filtros, su pagina ni su desplazamiento. Una recarga o la URL directa no
// interceptan: renderizan new/ o [id]/edit/ a pagina completa y la ranura
// queda en default.tsx (nada).
export default function MaterialsLayout({ children, panel }: LayoutProps<"/dashboard/inventory/materials">) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}
