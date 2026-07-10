import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
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
import { attendStockAlertAction } from "@/modules/inventory/alerts/actions";

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

function formatDate(value: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE").format(new Date(value));
}

export default async function InventoryAlertsPage() {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const isAdmin = session.user.role === "ADMIN";

  const [materials, alerts] = await Promise.all([
    prisma.material.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_material: "asc",
      },
    }),
    prisma.alerta_stock.findMany({
      orderBy: {
        fecha_alerta: "desc",
      },
    }),
  ]);

  const criticalMaterials = materials.filter((material) => {
    const stockActual = Number(material.stock_actual.toString());
    const stockReservado = Number(material.stock_reservado.toString());
    const stockMinimo = Number(material.stock_minimo.toString());
    const stockDisponible = stockActual - stockReservado;

    return stockMinimo > 0 && stockDisponible <= stockMinimo;
  });

  const materialIds = [...new Set(alerts.map((alert) => alert.id_material))];

  const alertMaterials = await prisma.material.findMany({
    where: {
      id_material: {
        in: materialIds,
      },
    },
  });

  const materialById = new Map(
    alertMaterials.map((material) => [material.id_material, material]),
  );

  return (
    <main className="space-y-6">
      <PageHeader
        title="Alertas y stock crítico"
        description="Consulta materiales por debajo del stock mínimo y alertas generadas por el sistema."
        backHref={navigationHrefs.inventory}
        backLabel="Volver a inventario"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Alertas" },
        ])}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard
          title="Materiales activos"
          value={materials.length.toString()}
          description="Materiales disponibles para uso."
          tone="info"
        />
        <KpiCard
          title="Materiales críticos"
          value={criticalMaterials.length.toString()}
          description="Bajo el stock mínimo definido."
          tone="warning"
        />
        <KpiCard
          title="Alertas activas"
          value={alerts
            .filter((alert) => alert.estado_alerta === "activa")
            .length.toString()}
          description="Alertas generadas sin atender."
          tone="warning"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock crítico actual</CardTitle>
          <p className="text-sm text-muted-foreground">
            Materiales cuyo stock disponible está igual o por debajo del
            stock mínimo.
          </p>
        </CardHeader>

        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Stock actual</TableHead>
                <TableHead>Reservado</TableHead>
                <TableHead>Disponible</TableHead>
                <TableHead>Stock mínimo</TableHead>
                <TableHead>Unidad</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {criticalMaterials.map((material) => {
                const stockActual = Number(material.stock_actual.toString());
                const stockReservado = Number(
                  material.stock_reservado.toString(),
                );
                const stockDisponible = stockActual - stockReservado;

                return (
                  <TableRow key={material.id_material}>
                    <TableCell className="font-medium">
                      {material.nombre_material}
                    </TableCell>
                    <TableCell>{material.categoria}</TableCell>
                    <TableCell>
                      {formatDecimal(material.stock_actual)}
                    </TableCell>
                    <TableCell>
                      {formatDecimal(material.stock_reservado)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        {stockDisponible.toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDecimal(material.stock_minimo)}
                    </TableCell>
                    <TableCell>{material.unidad_medida}</TableCell>
                  </TableRow>
                );
              })}

              {criticalMaterials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      className="border-0"
                      label="No hay materiales en stock crítico."
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
          <CardTitle className="text-base">Historial de alertas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Alertas generadas cuando un material llega al stock mínimo.
          </p>
        </CardHeader>

        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Stock detectado</TableHead>
                <TableHead>Stock mínimo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Mensaje</TableHead>
                {isAdmin ? <TableHead>Acción</TableHead> : null}
              </TableRow>
            </TableHeader>

            <TableBody>
              {alerts.map((alert) => {
                const material = materialById.get(alert.id_material);
                const isActive = alert.estado_alerta === "activa";

                return (
                  <TableRow key={alert.id_alerta}>
                    <TableCell>{formatDate(alert.fecha_alerta)}</TableCell>
                    <TableCell className="font-medium">
                      {material?.nombre_material ?? alert.id_material}
                    </TableCell>
                    <TableCell>
                      {formatDecimal(alert.stock_detectado)}
                    </TableCell>
                    <TableCell>{formatDecimal(alert.stock_minimo)}</TableCell>
                    <TableCell>
                      <Badge variant={isActive ? "destructive" : "success"}>
                        {alert.estado_alerta}
                      </Badge>
                    </TableCell>
                    <TableCell>{alert.mensaje ?? "-"}</TableCell>

                    {isAdmin ? (
                      <TableCell>
                        {isActive ? (
                          <form action={attendStockAlertAction}>
                            <input
                              type="hidden"
                              name="id_alerta"
                              value={alert.id_alerta}
                            />
                            <Button type="submit" variant="outline" size="sm">
                              Marcar atendida
                            </Button>
                          </form>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}

              {alerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="p-0">
                    <EmptyState
                      className="border-0"
                      label="Todavía no hay alertas registradas."
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
