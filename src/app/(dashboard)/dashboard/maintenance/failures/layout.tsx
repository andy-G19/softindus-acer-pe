// Fallas con panel lateral (entrega 10.5b), como Maquinas y Repuestos: la
// ranura @panel recibe el alta interceptada ((.)new) cuando se abre desde el
// listado, y muestra el panel encima de la lista. Una recarga o la URL directa
// no interceptan: renderizan new/ a pagina completa y la ranura queda en
// default.tsx (nada).
export default function FailuresLayout({ children, panel }: LayoutProps<"/dashboard/maintenance/failures">) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}
