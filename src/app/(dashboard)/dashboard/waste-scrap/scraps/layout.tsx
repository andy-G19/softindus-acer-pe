// Chatarra con panel lateral (entrega 10.7a), como Campanas: la ranura @panel recibe el
// alta interceptada ((.)new) cuando se abre desde el listado, y muestra el panel encima
// de la lista sin perder sus filtros. Una recarga o la URL directa no interceptan:
// renderizan new/ a pagina completa y la ranura queda en default.tsx (nada).
export default function ScrapsLayout({ children, panel }: LayoutProps<"/dashboard/waste-scrap/scraps">) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}
