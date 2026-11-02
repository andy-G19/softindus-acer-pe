import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { productionNotifications } from "@/modules/production/notifications";
import { updateRecipeDetailAction } from "@/modules/production/recipe-details/actions";
import { getRecipeDetailEditValues } from "@/modules/production/recipe-details/recipe-detail-edit-values";
import { RecipeDetailForm } from "@/modules/production/recipe-details/recipe-detail-form";
import { EditRecipeDetailNotices } from "@/modules/production/recipe-details/recipe-detail-notices";
import { canEditRecipeDetails } from "@/modules/production/recipe-details/recipe-detail-rules";
import { buildRecipeMaterialOptions } from "@/modules/production/recipe-details/recipe-material-options";
import { getRecipeDetailEditData } from "@/modules/production/recipe-details/queries";

type EditRecipeDetailPageProps = {
  params: Promise<{
    id: string;
    versionId: string;
    detailId: string;
  }>;
};

export default async function EditRecipeDetailPage({
  params,
}: EditRecipeDetailPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id, versionId, detailId } = await params;

  const recipeDetailEditData = await getRecipeDetailEditData(
    id,
    versionId,
    detailId,
  );

  if (!recipeDetailEditData) {
    notFound();
  }

  const { detail, materials } = recipeDetailEditData;
  const version = detail.version_receta;

  const detailsHref = `/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/details`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Editar material de receta"
        description={`Receta: ${version.receta_tecnica.nombre_receta} · Versión: ${version.numero_version} · Producto: ${version.receta_tecnica.producto.nombre_producto}`}
        backHref={detailsHref}
        backLabel="Volver al detalle"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Recetas", href: navigationHrefs.recipes },
          { label: "Editar material" },
        ])}
      />

      <RecipeDetailForm
        action={updateRecipeDetailAction}
        versionId={version.id_version_receta}
        materials={buildRecipeMaterialOptions(materials)}
        defaultValues={getRecipeDetailEditValues(detail)}
        submitLabel="Guardar cambios"
        successNotification={productionNotifications["recipe-detail-updated"]}
        returnTo={detailsHref}
        notices={<EditRecipeDetailNotices version={version} detail={detail} />}
        disabled={!canEditRecipeDetails(version)}
      />
    </div>
  );
}
