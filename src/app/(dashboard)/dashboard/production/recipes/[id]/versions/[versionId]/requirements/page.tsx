import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { materialRequirementCalculationSchema } from "@/schemas/production/material-requirement.schema";

type MaterialRequirementsPageProps = {
  params: Promise<{
    id: string;
    versionId: string;
  }>;
  searchParams: Promise<{
    quantity?: string;
  }>;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatDecimal(value: unknown) {
  return toNumber(value).toFixed(2);
}

function formatMoney(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
}

function calculateRequiredWithWaste(baseQuantity: number, wastePercentage: number) {
  return baseQuantity * (1 + wastePercentage / 100);
}

export default async function MaterialRequirementsPage({
  params,
  searchParams,
}: MaterialRequirementsPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id, versionId } = await params;
  const resolvedSearchParams = await searchParams;

  const rawQuantity = resolvedSearchParams.quantity ?? "";

  const parsedQuantity = materialRequirementCalculationSchema.safeParse({
    quantity: rawQuantity || 1,
  });

  const quantityToProduce = parsedQuantity.success
    ? parsedQuantity.data.quantity
    : 1;

  const hasInvalidQuantity = Boolean(rawQuantity) && !parsedQuantity.success;

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
        include: {
          material: true,
        },
        orderBy: {
          id_detalle_receta: "asc",
        },
      },
    },
  });

  if (!version) {
    notFound();
  }

  const calculationRows = version.detalle_receta.map((detail) => {
    const baseQuantityPerUnit = toNumber(detail.cantidad_requerida);
    const wastePercentage = toNumber(detail.merma_estimada_porcentaje);
    const requiredWithoutWaste = baseQuantityPerUnit * quantityToProduce;
    const requiredWithWaste = calculateRequiredWithWaste(
      requiredWithoutWaste,
      wastePercentage,
    );

    const currentStock = toNumber(detail.material.stock_actual);
    const reservedStock = toNumber(detail.material.stock_reservado);
    const availableStock = currentStock - reservedStock;

    const shortage = Math.max(requiredWithWaste - availableStock, 0);
    const hasEnoughStock = availableStock >= requiredWithWaste;

    const unitCost = toNumber(detail.material.costo_unitario_actual);
    const estimatedCost = requiredWithWaste * unitCost;

    return {
      id: detail.id_detalle_receta,
      materialName: detail.material.nombre_material,
      materialCategory: detail.material.categoria,
      materialUnit: detail.material.unidad_medida,
      recipeUnit: detail.unidad_medida,
      consumptionType: detail.tipo_consumo,
      baseQuantityPerUnit,
      requiredWithoutWaste,
      wastePercentage,
      requiredWithWaste,
      currentStock,
      reservedStock,
      availableStock,
      shortage,
      hasEnoughStock,
      unitCost,
      estimatedCost,
      observations: detail.observaciones,
    };
  });

  const totalEstimatedCost = calculationRows.reduce(
    (total, row) => total + row.estimatedCost,
    0,
  );

  const criticalMaterials = calculationRows.filter(
    (row) => !row.hasEnoughStock,
  );

  const availableMaterials = calculationRows.filter(
    (row) => row.hasEnoughStock,
  );

  return (
    <main className="space-y-6">
      <PageHeader
        title="Cálculo de materiales requeridos"
        description={`Receta: ${version.receta_tecnica.nombre_receta} · Versión: ${version.numero_version} · Producto: ${version.receta_tecnica.producto.nombre_producto}`}
        backHref={`/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/details`}
        backLabel="Volver al detalle"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Recetas", href: navigationHrefs.recipes },
          { label: "Cálculo de materiales" },
        ])}
      />

      {hasInvalidQuantity ? (
        <Alert variant="destructive">
          <AlertDescription>
            La cantidad ingresada no es válida. Se está mostrando el cálculo
            para una unidad.
          </AlertDescription>
        </Alert>
      ) : null}

      {version.estado !== "vigente" ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta versión no está vigente. El cálculo se muestra solo como
            referencia.
          </AlertDescription>
        </Alert>
      ) : null}

      {version.receta_tecnica.estado !== "activa" ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta receta no está activa. El cálculo se muestra solo como
            referencia.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="rounded-xl border border-border/80 bg-card p-6 shadow-sm">
        <form className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="quantity">Cantidad a fabricar *</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={quantityToProduce}
            />
            <p className="text-xs text-muted-foreground">
              El sistema multiplicará los materiales de la receta por esta
              cantidad.
            </p>
          </div>

          <Button type="submit">Calcular</Button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Cantidad a fabricar" value={formatDecimal(quantityToProduce)} description="Unidades objetivo." tone="info" />
        <KpiCard title="Materiales evaluados" value={calculationRows.length.toString()} description="Del detalle de receta." tone="info" />
        <KpiCard title="Con stock suficiente" value={availableMaterials.length.toString()} description="Listos para producir." tone="success" />
        <KpiCard title="Costo estimado total" value={formatMoney(totalEstimatedCost)} description="Con merma incluida." tone="warning" />
      </section>

      {criticalMaterials.length > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            Hay {criticalMaterials.length} material(es) sin stock suficiente
            para esta producción. Revisa la columna de faltante antes de
            crear una orden de trabajo.
          </AlertDescription>
        </Alert>
      ) : null}

      {version.detalle_receta.length === 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta versión de receta no tiene materiales registrados. Primero
            agrega materiales al detalle de receta.
          </AlertDescription>
        </Alert>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Cant. por unidad</TableHead>
            <TableHead>Requerido base</TableHead>
            <TableHead>Merma</TableHead>
            <TableHead>Requerido total</TableHead>
            <TableHead>Stock disponible</TableHead>
            <TableHead>Faltante</TableHead>
            <TableHead>Costo estimado</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {calculationRows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="font-medium">{row.materialName}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Categoría: {row.materialCategory}
                </p>
                {row.observations ? (
                  <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                    {row.observations}
                  </p>
                ) : null}
              </TableCell>

              <TableCell className="capitalize">
                {row.consumptionType}
              </TableCell>

              <TableCell>
                {formatDecimal(row.baseQuantityPerUnit)} {row.recipeUnit}
              </TableCell>

              <TableCell>
                {formatDecimal(row.requiredWithoutWaste)} {row.recipeUnit}
              </TableCell>

              <TableCell>{formatDecimal(row.wastePercentage)}%</TableCell>

              <TableCell className="font-medium">
                {formatDecimal(row.requiredWithWaste)} {row.recipeUnit}
              </TableCell>

              <TableCell>
                {formatDecimal(row.availableStock)} {row.materialUnit}
                <p className="mt-1 text-xs text-muted-foreground">
                  Stock: {formatDecimal(row.currentStock)} · Reservado:{" "}
                  {formatDecimal(row.reservedStock)}
                </p>
              </TableCell>

              <TableCell>
                {formatDecimal(row.shortage)} {row.materialUnit}
              </TableCell>

              <TableCell className="font-medium">
                {formatMoney(row.estimatedCost)}
              </TableCell>

              <TableCell>
                <Badge variant={row.hasEnoughStock ? "success" : "destructive"}>
                  {row.hasEnoughStock ? "Suficiente" : "Insuficiente"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}

          {calculationRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                No hay materiales para calcular.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <Alert variant="info">
        <AlertDescription>
          El sistema usa el stock disponible, es decir, stock actual menos
          stock reservado. Si la cantidad requerida total supera el stock
          disponible, se marca como insuficiente y se muestra el faltante.
        </AlertDescription>
      </Alert>
    </main>
  );
}
