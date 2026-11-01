// Rutas con panel lateral (entrega 10.6a), como Productos: la ranura @panel recibe
// el alta y la edicion interceptadas ((.)new y (.)[id]/edit) cuando se abren desde
// el listado, y muestra el panel encima de la lista sin perder sus filtros. Una
// recarga o la URL directa no interceptan: renderizan new/ o [id]/edit/ a pagina
// completa y la ranura queda en default.tsx (nada), igual que en las etapas de
// una ruta, que viven debajo de este layout con su propia ranura.
export default function FabricationRoutesLayout({ children, panel }: LayoutProps<"/dashboard/production/routes">) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}
