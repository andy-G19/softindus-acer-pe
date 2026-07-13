import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type ProductionCampaignDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

export default async function ProductionCampaignDetailPage({
  params,
}: ProductionCampaignDetailPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id } = await params;

  const campaign = await prisma.campania_produccion.findUnique({
    where: {
      id_campania: id,
    },
    include: {
      campania_detalle: {
        include: {
          producto: true,
        },
        orderBy: {
          id_campania_detalle: "asc",
        },
      },
      orden_trabajo: {
        include: {
          producto: true,
        },
        orderBy: {
          fecha_registro: "desc",
        },
        take: 8,
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  const canAddDetails = !["finalizada", "anulada"].includes(campaign.estado);
  const totalTarget = campaign.campania_detalle.reduce(
    (total, detail) => total + toNumber(detail.cantidad_objetivo),
    0,
  );
  const totalProduced = campaign.campania_detalle.reduce(
    (total, detail) => total + toNumber(detail.cantidad_producida),
    0,
  );
  const pendingProduction = Math.max(totalTarget - totalProduced, 0);
  const progress =
    totalTarget > 0 ? Math.min((totalProduced / totalTarget) * 100, 100) : 0;

  return (
    <main className="space-y-6">
      <PageHeader
        title={campaign.nombre_campania}
        description={campaign.objetivo_general ?? "Campaña sin objetivo general."}
        backHref={navigationHrefs.campaigns}
        backLabel="Volver a campañas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Campañas", href: navigationHrefs.campaigns },
          { label: "Detalle de campaña" },
        ])}
        actions={
          <>
            {canAddDetails ? (
              <Button variant="outline" asChild>
                <Link
                  href={`/dashboard/production/campaigns/${campaign.id_campania}/details/new`}
                >
                  Agregar producto
                </Link>
              </Button>
            ) : null}

            <Button asChild>
              <Link href="/dashboard/production/work-orders/new">
                Crear orden
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Productos" value={campaign.campania_detalle.length.toString()} description="Productos en la campaña." tone="info" />
        <KpiCard title="Cantidad objetivo" value={formatDecimal(totalTarget)} description="Meta total planificada." tone="info" />
        <KpiCard title="Cantidad producida" value={formatDecimal(totalProduced)} description="Avance real registrado." tone="success" />
        <KpiCard title="Pendiente estimado" value={formatDecimal(pendingProduction)} description="Restante por producir." tone="warning" />
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Avance general</CardTitle>
              <p className="text-sm text-muted-foreground">
                Calculado con las cantidades producidas registradas por
                producto.
              </p>
            </div>

            <span className="text-sm font-medium text-foreground">
              {progress.toFixed(2)}%
            </span>
          </div>
        </CardHeader>

        <CardContent>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-chart-3"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {!canAddDetails ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta campaña está finalizada o anulada. No se pueden agregar
            nuevos productos.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Productos de la campaña</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Producido</TableHead>
                <TableHead>Pendiente</TableHead>
                <TableHead>Observaciones</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {campaign.campania_detalle.map((detail) => {
                const target = toNumber(detail.cantidad_objetivo);
                const produced = toNumber(detail.cantidad_producida);

                return (
                  <TableRow key={detail.id_campania_detalle}>
                    <TableCell>
                      <div className="font-medium">
                        {detail.producto.nombre_producto}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {detail.id_campania_detalle}
                      </p>
                    </TableCell>

                    <TableCell className="capitalize">
                      {detail.producto.categoria}
                    </TableCell>

                    <TableCell>{detail.producto.unidad_medida}</TableCell>

                    <TableCell>{formatDecimal(target)}</TableCell>

                    <TableCell>{formatDecimal(produced)}</TableCell>

                    <TableCell>
                      {formatDecimal(Math.max(target - produced, 0))}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {detail.observaciones ?? "-"}
                    </TableCell>
                  </TableRow>
                );
              })}

              {campaign.campania_detalle.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      className="border-0"
                      label="Esta campaña todavía no tiene productos registrados."
                    />
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Órdenes asociadas</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {campaign.orden_trabajo.map((order) => (
                <TableRow key={order.id_orden_trabajo}>
                  <TableCell className="text-xs">
                    {order.id_orden_trabajo}
                  </TableCell>

                  <TableCell>{order.producto.nombre_producto}</TableCell>

                  <TableCell>
                    {formatDecimal(order.cantidad)}{" "}
                    {order.producto.unidad_medida}
                  </TableCell>

                  <TableCell>{formatDate(order.fecha_inicio)}</TableCell>

                  <TableCell>
                    <Badge variant="secondary">{order.estado}</Badge>
                  </TableCell>

                  <TableCell>
                    <Button variant="link" className="h-auto p-0" asChild>
                      <Link
                        href={`/dashboard/production/work-orders/${order.id_orden_trabajo}`}
                      >
                        Ver orden
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {campaign.orden_trabajo.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      className="border-0"
                      label="No hay órdenes de trabajo asociadas a esta campaña."
                    />
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
