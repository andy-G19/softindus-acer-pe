import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { productionNotifications } from "@/modules/production/notifications";
import { createTechnicalRecipeAction } from "@/modules/production/recipes/actions";
import { getNewTechnicalRecipeProducts } from "@/modules/production/recipes/queries";
import { RecipeForm } from "@/modules/production/recipes/recipe-form";
import { buildRouteProductOptions } from "@/modules/production/routes/route-product-options";

type NewTechnicalRecipePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewTechnicalRecipePage({ searchParams }: NewTechnicalRecipePageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.recipes);
  const products = await getNewTechnicalRecipeProducts();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nueva receta técnica"
        description="Registra la receta técnica base de un producto. Luego agregaremos versiones y materiales requeridos."
        backHref={backHref}
        backLabel="Volver a recetas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Recetas", href: backHref },
          { label: "Nueva receta" },
        ])}
      />

      <RecipeForm
        action={createTechnicalRecipeAction}
        products={buildRouteProductOptions(products)}
        successNotification={productionNotifications["recipe-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
