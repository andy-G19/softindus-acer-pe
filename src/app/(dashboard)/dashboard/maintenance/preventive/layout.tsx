// Preventivos con panel lateral (entrega 10.5b), como Fallas: la ranura @panel
// recibe el alta interceptada ((.)new) cuando se abre desde el listado, y
// muestra el panel encima de la lista sin perder sus filtros ni su
// desplazamiento. Una recarga o la URL directa no interceptan: renderizan new/
// a pagina completa y la ranura queda en default.tsx (nada).
export default function PreventiveLayout({ children, panel }: LayoutProps<"/dashboard/maintenance/preventive">) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}
