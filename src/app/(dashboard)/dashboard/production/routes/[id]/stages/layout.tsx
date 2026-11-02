// Etapas con panel lateral (entrega 10.6a). Esta ranura vive debajo de la de rutas:
// recibe el alta y la edicion interceptadas ((.)new y (.)[stageId]/edit) cuando se
// abren desde la lista de etapas. Una recarga o la URL directa no interceptan:
// renderizan new/ o [stageId]/edit/ a pagina completa y la ranura queda en
// default.tsx (nada).
export default function RouteStagesLayout({ children, panel }: LayoutProps<"/dashboard/production/routes/[id]/stages">) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}
