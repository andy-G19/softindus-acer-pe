import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { updateRecipeDetailAction } from "@/modules/production/recipe-details/actions";
import { RecipeDetailForm } from "@/modules/production/recipe-details/recipe-detail-form";

type EditRecipeDetailPageProps = {
  params: Promise<{
    id: string;
    versionId: string;
    detailId: string;
  }>;
};

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "S/ 0.00";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

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

  const detail = await prisma.detalle_receta.findFirst({
    where: {
      id_detalle_receta: detailId,
      id_version_receta: versionId,
    },
    include: {
      material: true,
      version_receta: {
        include: {
          receta_tecnica: {
            include: {
              producto: true,
            },
          },
          detalle_receta: {
            select: {
              id_material: true,
            },
          },
          _count: {
            select: {
              orden_trabajo: true,
            },
          },
        },
      },
    },
  });

  if (!detail || detail.version_receta.id_receta !== id) {
    notFound();
  }

  const version = detail.version_receta;

  // Los materiales ya usados en otras líneas se excluyen, pero el de esta línea se
  // conserva: si no, editar la cantidad obligaría a cambiar también el material.
  const usedMaterialIds = version.detalle_receta
    .map((item) => item.id_material)
    .filter((materialId) => materialId !== detail.id_material);

  const materials = await prisma.material.findMany({
    where: {
      OR: [
        {
          estado: true,
          id_material: {
            notIn: usedMaterialIds,
          },
        },
        // El material actual se incluye aunque hoy esté inactivo, para no borrarlo en
        // silencio al guardar cualquier otro cambio de la línea.
        { id_material: detail.id_material },
      ],
    },
    orderBy: [{ categoria: "asc" }, { nombre_material: "asc" }],
  });

  const canEditDetail =
    version.estado === "vigente" &&
    version.receta_tecnica.estado === "activa" &&
    version._count.orden_trabajo === 0;

  const materialItems = materials.map((material) => ({
    id: material.id_material,
    label: material.nombre_material,
    description: `${material.categoria} - Stock: ${formatDecimal(
      material.stock_actual,
    )} ${material.unidad_medida} - ${formatMoney(
      material.costo_unitario_actual,
    )}`,
    unidad_medida: material.unidad_medida,
  }));

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
