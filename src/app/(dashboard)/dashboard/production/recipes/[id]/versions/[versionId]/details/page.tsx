import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import Link from "next/link";

type RecipeDetailsPageProps = {
  params: Promise<{
    id: string;
    versionId: string;
  }>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value.toString()).toFixed(2);
}

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "S/ 0.00";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

function calculateRequiredWithWaste(quantity: unknown, waste: unknown) {
  const baseQuantity = Number(quantity?.toString() ?? 0);
  const wastePercentage = Number(waste?.toString() ?? 0);

  return baseQuantity * (1 + wastePercentage / 100);
}

export default async function RecipeDetailsPage({
  params,
}: RecipeDetailsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

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
        include: {
          material: true,
        },
        orderBy: {
          id_detalle_receta: "asc",
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

  const estimatedUnitCost = version.detalle_receta.reduce((total, detail) => {
    const requiredWithWaste = calculateRequiredWithWaste(
      detail.cantidad_requerida,
      detail.merma_estimada_porcentaje,
    );

    const unitCost = Number(detail.material.costo_unitario_actual.toString());

    return total + requiredWithWaste * unitCost;
  }, 0);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Detalle de receta"
        description={`Receta: ${version.receta_tecnica.nombre_receta} · Versión: ${version.numero_version} · Producto: ${version.receta_tecnica.producto.nombre_producto}`}
        backHref={`/dashboard/production/recipes/${version.id_receta}/versions`}
        backLabel="Volver a versiones"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Recetas", href: navigationHrefs.recipes },
          { label: "Materiales requeridos" },
        ])}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link
                href={`/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/requirements`}
              >
                Calcular materiales
              </Link>
            </Button>

            {version.estado === "vigente" &&
            version._count.orden_trabajo === 0 ? (
              <Button asChild>
                <Link
                  href={`/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/details/new`}
                >
                  Agregar material
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Materiales registrados" value={version.detalle_receta.length.toString()} description="Total en esta versión." tone="info" />
        <KpiCard
          title="Materia prima"
          value={version.detalle_receta
            .filter((detail) => detail.tipo_consumo === "materia_prima")
            .length.toString()}
          description="Tipo de consumo principal."
          tone="info"
        />
        <KpiCard
          title="Consumibles"
          value={version.detalle_receta
            .filter((detail) => detail.tipo_consumo === "consumible")
            .length.toString()}
          description="Tipo de consumo secundario."
          tone="info"
        />
        <KpiCard title="Costo estimado por unidad" value={formatMoney(estimatedUnitCost)} description="Con merma incluida." tone="warning" />
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Material</TableHead>
            <TableHead>Tipo consumo</TableHead>
            <TableHead>Cantidad base</TableHead>
            <TableHead>Merma</TableHead>
            <TableHead>Cant. con merma</TableHead>
            <TableHead>Costo unitario</TableHead>
            <TableHead>Costo estimado</TableHead>
            <TableHead>Stock actual</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {version.detalle_receta.map((detail) => {
            const requiredWithWaste = calculateRequiredWithWaste(
              detail.cantidad_requerida,
              detail.merma_estimada_porcentaje,
            );

            const unitCost = Number(
              detail.material.costo_unitario_actual.toString(),
            );

            const estimatedCost = requiredWithWaste * unitCost;

            return (
              <TableRow key={detail.id_detalle_receta}>
                <TableCell className="text-xs">
                  {detail.id_detalle_receta}
                </TableCell>

                <TableCell>
                  <div className="font-medium">
                    {detail.material.nombre_material}
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Categoría: {detail.material.categoria}
                  </p>

                  {detail.observaciones ? (
                    <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                      {detail.observaciones}
                    </p>
                  ) : null}
                </TableCell>

                <TableCell className="capitalize">
                  {detail.tipo_consumo}
                </TableCell>

                <TableCell>
                  {formatDecimal(detail.cantidad_requerida)}{" "}
                  {detail.unidad_medida}
                </TableCell>

                <TableCell>
                  {detail.merma_estimada_porcentaje
                    ? `${formatDecimal(detail.merma_estimada_porcentaje)}%`
                    : "0.00%"}
                </TableCell>

                <TableCell>
                  {requiredWithWaste.toFixed(2)} {detail.unidad_medida}
                </TableCell>

                <TableCell>
                  {formatMoney(detail.material.costo_unitario_actual)}
                </TableCell>

                <TableCell className="font-medium">
                  {formatMoney(estimatedCost)}
                </TableCell>

                <TableCell>
                  {formatDecimal(detail.material.stock_actual)}{" "}
                  {detail.material.unidad_medida}
                </TableCell>
              </TableRow>
            );
          })}

          {version.detalle_receta.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay materiales registrados para esta versión de receta."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <Alert variant="info">
        <AlertDescription>
          El costo estimado por unidad se calcula usando la cantidad
          requerida, la merma estimada y el costo unitario actual del
          material. Al generar una orden de trabajo, estos valores se
          multiplican por la cantidad a fabricar y se valida el stock
          disponible.
        </AlertDescription>
      </Alert>

      {version._count.orden_trabajo > 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta versión ya fue usada por órdenes de trabajo. Sus materiales
            se conservan como historial y no deben modificarse; crea una
            nueva versión para futuros cambios.
          </AlertDescription>
        </Alert>
      ) : null}
    </main>
  );
}
