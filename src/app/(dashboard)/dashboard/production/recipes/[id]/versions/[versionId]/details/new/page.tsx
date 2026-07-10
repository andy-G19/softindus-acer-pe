import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { createRecipeDetailAction } from "@/modules/production/recipe-details/actions";
import Link from "next/link";

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

      <form
        action={createRecipeDetailAction}
        className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
      >
        <input
          type="hidden"
          name="id_version_receta"
          value={version.id_version_receta}
        />

        <div className="space-y-2">
          <SearchableSelect
            name="id_material"
            label="Material o insumo"
            placeholder="Buscar material..."
            items={materialItems}
            required
            disabled={!canAddDetail}
            emptyMessage="No hay materiales disponibles para esta receta."
          />

          <p className="text-xs text-muted-foreground">
            La unidad de medida se tomará automáticamente desde el material
            registrado en inventario.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Cantidad requerida por unidad *</Label>
            <Input
              name="cantidad_requerida"
              type="number"
              min="0.01"
              step="0.01"
              required
              disabled={!canAddDetail}
              placeholder="Ej. 1.20"
            />
          </div>

          <div className="space-y-2">
            <Label>Merma estimada (%)</Label>
            <Input
              name="merma_estimada_porcentaje"
              type="number"
              min="0"
              max="100"
              step="0.01"
              disabled={!canAddDetail}
              placeholder="Ej. 5"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tipo de consumo *</Label>
          <NativeSelect name="tipo_consumo" required disabled={!canAddDetail}>
            <option value="">Seleccione el tipo</option>
            <option value="materia_prima">Materia prima</option>
            <option value="consumible">Consumible</option>
            <option value="auxiliar">Auxiliar</option>
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label>Observaciones</Label>
          <Textarea
            name="observaciones"
            rows={4}
            maxLength={700}
            disabled={!canAddDetail}
            placeholder="Ej. Considerar margen adicional si la plancha viene con defectos o cortes irregulares."
          />
        </div>

        <Alert variant="info">
          <AlertDescription>
            La cantidad registrada representa el consumo estimado para
            fabricar una unidad del producto. Estos datos se usan luego para
            calcular materiales requeridos según la cantidad a producir.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between pt-4">
          <Button variant="link" className="h-auto p-0" asChild>
            <Link
              href={`/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/details`}
            >
              Cancelar
            </Link>
          </Button>

          <Button type="submit" disabled={!canAddDetail}>
            Guardar material
          </Button>
        </div>
      </form>
    </main>
  );
}
