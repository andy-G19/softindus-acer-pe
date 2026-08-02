import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { createRecipeDetailAction } from "@/modules/production/recipe-details/actions";
import { RecipeDetailForm } from "@/modules/production/recipe-details/recipe-detail-form";

type NewRecipeDetailPageProps = {
  params: Promise<{
    id: string;
    versionId: string;
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

export default async function NewRecipeDetailPage({
  params,
}: NewRecipeDetailPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id, versionId } = await params;

  const version = await prisma.version_receta.findFirst({
    where: {
      id_version_receta: versionId,
      id_receta: id,
    },
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
  });

  if (!version) {
    notFound();
  }

  const usedMaterialIds = version.detalle_receta.map(
    (detail) => detail.id_material,
  );

  const materials = await prisma.material.findMany({
    where: {
      estado: true,
      id_material: {
        notIn: usedMaterialIds,
      },
    },
    orderBy: [
      {
        categoria: "asc",
      },
      {
        nombre_material: "asc",
      },
    ],
  });

  const canAddDetail =
    version.estado === "vigente" &&
    version.receta_tecnica.estado === "activa" &&
    version._count.orden_trabajo === 0 &&
    materials.length > 0;

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

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Agregar material a receta"
        description={`Receta: ${version.receta_tecnica.nombre_receta} · Versión: ${version.numero_version} · Producto: ${version.receta_tecnica.producto.nombre_producto}`}
        backHref={`/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/details`}
        backLabel="Volver al detalle"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Recetas", href: navigationHrefs.recipes },
          { label: "Agregar material" },
        ])}
      />

      {version.estado !== "vigente" ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta versión no está vigente. Solo se pueden agregar materiales a
            una versión vigente.
          </AlertDescription>
        </Alert>
      ) : null}

      {version.receta_tecnica.estado !== "activa" ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta receta no está activa. Actívala antes de agregar materiales.
          </AlertDescription>
        </Alert>
      ) : null}

      {materials.length === 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            No hay materiales activos disponibles o todos los materiales
            activos ya fueron agregados a esta versión de receta.
          </AlertDescription>
        </Alert>
      ) : null}

      {version._count.orden_trabajo > 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta versión ya fue usada por órdenes de trabajo. Crea una nueva
            versión para cambiar materiales sin afectar órdenes históricas.
          </AlertDescription>
        </Alert>
      ) : null}

      <Alert variant="info">
        <AlertDescription>
          La cantidad registrada representa el consumo estimado para fabricar
          <strong> una unidad</strong> del producto. Se multiplica por la
          cantidad de la orden al calcular los materiales requeridos.
        </AlertDescription>
      </Alert>

      <RecipeDetailForm
        action={createRecipeDetailAction}
        versionId={version.id_version_receta}
        backHref={`/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/details`}
        materials={materialItems}
        submitLabel="Guardar material"
        disabled={!canAddDetail}
      />
    </main>
  );
}
