import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { updateRecipeDetailAction } from "@/modules/production/recipe-details/actions";
import { RecipeDetailForm } from "@/modules/production/recipe-details/recipe-detail-form";
import { buildRecipeMaterialOptions } from "@/modules/production/recipe-details/recipe-material-options";
import { getRecipeDetailEditData } from "@/modules/production/recipe-details/queries";

type EditRecipeDetailPageProps = {
  params: Promise<{
    id: string;
    versionId: string;
    detailId: string;
  }>;
};

function formatInputNumber(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return Number(value.toString()).toString();
}

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

  const canEditDetail =
    version.estado === "vigente" &&
    version.receta_tecnica.estado === "activa" &&
    version._count.orden_trabajo === 0;

  const materialItems = buildRecipeMaterialOptions(materials);

  const detailsHref = `/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/details`;

  const hasUnitDrift =
    detail.unidad_medida.trim().toLowerCase() !==
    detail.material.unidad_medida.trim().toLowerCase();

  return (
    <main className="mx-auto max-w-3xl space-y-6">
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

      {version._count.orden_trabajo > 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta versión ya fue usada por órdenes de trabajo y no puede
            modificarse. Crea una nueva versión para cambiar materiales sin
            afectar órdenes históricas.
          </AlertDescription>
        </Alert>
      ) : null}

      {version.estado !== "vigente" ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta versión no está vigente. Solo se pueden editar materiales de
            una versión vigente.
          </AlertDescription>
        </Alert>
      ) : null}

      {hasUnitDrift ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta línea está registrada en <strong>{detail.unidad_medida}</strong>{" "}
            y el material hoy se mide en{" "}
            <strong>{detail.material.unidad_medida}</strong>. Al guardar, la
            unidad se actualizará a la del material: revisa que la cantidad
            siga siendo correcta en esa unidad.
          </AlertDescription>
        </Alert>
      ) : null}

      <RecipeDetailForm
        action={updateRecipeDetailAction}
        versionId={version.id_version_receta}
        backHref={detailsHref}
        materials={materialItems}
        defaultValues={{
          id_detalle_receta: detail.id_detalle_receta,
          id_material: detail.id_material,
          cantidad_requerida: formatInputNumber(detail.cantidad_requerida),
          merma_estimada_porcentaje: formatInputNumber(
            detail.merma_estimada_porcentaje,
          ),
          tipo_consumo: detail.tipo_consumo,
          observaciones: detail.observaciones ?? "",
        }}
        submitLabel="Guardar cambios"
        disabled={!canEditDetail}
      />
    </main>
  );
}
