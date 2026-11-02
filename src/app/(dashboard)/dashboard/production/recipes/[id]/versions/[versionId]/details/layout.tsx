// Materiales de una version con panel lateral (entrega 10.6b). Esta ranura vive
// debajo de la de recetas, como la de etapas debajo de la de rutas: recibe el alta y
// la edicion interceptadas ((.)new y (.)[detailId]/edit) cuando se abren desde la
// lista. Una recarga o la URL directa no interceptan: renderizan new/ o
// [detailId]/edit/ a pagina completa y la ranura queda en default.tsx (nada).
export default function RecipeDetailsLayout({
  children,
  panel,
}: LayoutProps<"/dashboard/production/recipes/[id]/versions/[versionId]/details">) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}
