import { notFound } from "next/navigation";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { productionNotifications } from "@/modules/production/notifications";
import { createRecipeDetailAction } from "@/modules/production/recipe-details/actions";
import { RecipeDetailForm } from "@/modules/production/recipe-details/recipe-detail-form";
import { NewRecipeDetailNotices } from "@/modules/production/recipe-details/recipe-detail-notices";
import { canEditRecipeDetails } from "@/modules/production/recipe-details/recipe-detail-rules";
import { buildRecipeMaterialOptions } from "@/modules/production/recipe-details/recipe-material-options";
import { getNewRecipeDetailData } from "@/modules/production/recipe-details/queries";

type NewRecipeDetailPanelProps = {
  params: Promise<{ id: string; versionId: string }>;
};

// Alta de material en panel lateral (entrega 10.6b), interceptada desde la lista.
// Mismo formulario, consulta, accion y permisos que new/page.tsx.
export default async function NewRecipeDetailPanel({ params }: NewRecipeDetailPanelProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id, versionId } = await params;

  const newRecipeDetailData = await getNewRecipeDetailData(id, versionId);

  if (!newRecipeDetailData) {
    notFound();
  }

  const { version, materials } = newRecipeDetailData;

  return (
    <RouteSheet
      title="Agregar material a receta"
      description={`Receta: ${version.receta_tecnica.nombre_receta} · Versión: ${version.numero_version} · Producto: ${version.receta_tecnica.producto.nombre_producto}`}
      discardTitle="¿Descartar el material nuevo?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <RecipeDetailForm
        action={createRecipeDetailAction}
        versionId={version.id_version_receta}
        materials={buildRecipeMaterialOptions(materials)}
        submitLabel="Guardar material"
        successNotification={productionNotifications["recipe-detail-created"]}
        returnTo={`/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/details`}
        notices={<NewRecipeDetailNotices version={version} hasMaterials={materials.length > 0} />}
        disabled={!canEditRecipeDetails(version) || materials.length === 0}
      />
    </RouteSheet>
  );
}
