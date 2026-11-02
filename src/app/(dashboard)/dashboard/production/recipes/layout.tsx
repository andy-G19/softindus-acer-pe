// Recetas con panel lateral (entrega 10.6b), como Rutas: la ranura @panel recibe el
// alta interceptada ((.)new) cuando se abre desde el listado, y muestra el panel
// encima de la lista sin perder sus filtros. Una recarga o la URL directa no
// interceptan: renderizan new/ a pagina completa y la ranura queda en default.tsx
// (nada). Una receta no se edita, asi que no hay (.)[id]/edit.
export default function TechnicalRecipesLayout({ children, panel }: LayoutProps<"/dashboard/production/recipes">) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}
