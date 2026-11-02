import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { productionNotifications } from "@/modules/production/notifications";
import { createRecipeDetailAction } from "@/modules/production/recipe-details/actions";
import { RecipeDetailForm } from "@/modules/production/recipe-details/recipe-detail-form";
import { NewRecipeDetailNotices } from "@/modules/production/recipe-details/recipe-detail-notices";
import { canEditRecipeDetails } from "@/modules/production/recipe-details/recipe-detail-rules";
import { buildRecipeMaterialOptions } from "@/modules/production/recipe-details/recipe-material-options";
import { getNewRecipeDetailData } from "@/modules/production/recipe-details/queries";

type NewRecipeDetailPageProps = {
  params: Promise<{
    id: string;
    versionId: string;
  }>;
};

export default async function NewRecipeDetailPage({
  params,
}: NewRecipeDetailPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id, versionId } = await params;

  const newRecipeDetailData = await getNewRecipeDetailData(id, versionId);

  if (!newRecipeDetailData) {
    notFound();
  }

  const { version, materials } = newRecipeDetailData;

  const detailsHref = `/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/details`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Agregar material a receta"
        description={`Receta: ${version.receta_tecnica.nombre_receta} · Versión: ${version.numero_version} · Producto: ${version.receta_tecnica.producto.nombre_producto}`}
        backHref={detailsHref}
        backLabel="Volver al detalle"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Recetas", href: navigationHrefs.recipes },
          { label: "Agregar material" },
        ])}
      />

      <RecipeDetailForm
        action={createRecipeDetailAction}
        versionId={version.id_version_receta}
        materials={buildRecipeMaterialOptions(materials)}
        submitLabel="Guardar material"
        successNotification={productionNotifications["recipe-detail-created"]}
        returnTo={detailsHref}
        notices={<NewRecipeDetailNotices version={version} hasMaterials={materials.length > 0} />}
        disabled={!canEditRecipeDetails(version) || materials.length === 0}
      />
    </div>
  );
}
