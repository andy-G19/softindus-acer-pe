import { notFound } from "next/navigation";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { productionNotifications } from "@/modules/production/notifications";
import { updateRecipeDetailAction } from "@/modules/production/recipe-details/actions";
import { getRecipeDetailEditValues } from "@/modules/production/recipe-details/recipe-detail-edit-values";
import { RecipeDetailForm } from "@/modules/production/recipe-details/recipe-detail-form";
import { EditRecipeDetailNotices } from "@/modules/production/recipe-details/recipe-detail-notices";
import { canEditRecipeDetails } from "@/modules/production/recipe-details/recipe-detail-rules";
import { buildRecipeMaterialOptions } from "@/modules/production/recipe-details/recipe-material-options";
import { getRecipeDetailEditData } from "@/modules/production/recipe-details/queries";

type EditRecipeDetailPanelProps = {
  params: Promise<{ id: string; versionId: string; detailId: string }>;
};

// Edicion de material en panel lateral (entrega 10.6b), interceptada desde la lista.
// Misma consulta, formulario, accion y permisos que [detailId]/edit/page.tsx.
export default async function EditRecipeDetailPanel({ params }: EditRecipeDetailPanelProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id, versionId, detailId } = await params;

  const recipeDetailEditData = await getRecipeDetailEditData(id, versionId, detailId);

  if (!recipeDetailEditData) {
    notFound();
  }

  const { detail, materials } = recipeDetailEditData;
  const version = detail.version_receta;

  return (
    <RouteSheet
      title="Editar material de receta"
      description={`Receta: ${version.receta_tecnica.nombre_receta} · Versión: ${version.numero_version} · Producto: ${version.receta_tecnica.producto.nombre_producto}`}
      discardTitle="¿Descartar los cambios del material?"
      discardDescription="Se perderán los cambios que hiciste en este panel."
    >
      <RecipeDetailForm
        action={updateRecipeDetailAction}
        versionId={version.id_version_receta}
        materials={buildRecipeMaterialOptions(materials)}
        defaultValues={getRecipeDetailEditValues(detail)}
        submitLabel="Guardar cambios"
        successNotification={productionNotifications["recipe-detail-updated"]}
        returnTo={`/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/details`}
        notices={<EditRecipeDetailNotices version={version} detail={detail} />}
        disabled={!canEditRecipeDetails(version)}
      />
    </RouteSheet>
  );
}
