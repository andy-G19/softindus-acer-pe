import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { productionNotifications } from "@/modules/production/notifications";
import { createTechnicalRecipeAction } from "@/modules/production/recipes/actions";
import { getNewTechnicalRecipeProducts } from "@/modules/production/recipes/queries";
import { RecipeForm } from "@/modules/production/recipes/recipe-form";
import { buildRouteProductOptions } from "@/modules/production/routes/route-product-options";

type NewRecipePanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de receta en panel lateral (entrega 10.6b), interceptada desde el listado.
// Mismo formulario, consulta, accion y permisos que new/page.tsx.
export default async function NewRecipePanel({ searchParams }: NewRecipePanelProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.recipes);
  const products = await getNewTechnicalRecipeProducts();

  return (
    <RouteSheet
      title="Nueva receta técnica"
      description="Registra la receta técnica base de un producto. Luego agregaremos versiones y materiales requeridos."
      discardTitle="¿Descartar la receta nueva?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <RecipeForm
        action={createTechnicalRecipeAction}
        products={buildRouteProductOptions(products)}
        successNotification={productionNotifications["recipe-created"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
