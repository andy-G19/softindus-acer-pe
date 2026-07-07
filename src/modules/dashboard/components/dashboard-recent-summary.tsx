import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatDecimal, formatMoney } from "@/lib/formatters";
import type { DashboardData } from "@/modules/dashboard/data";

type DashboardRecentSummaryProps = {
  dashboardData: DashboardData;
};

export function DashboardRecentSummary({
  dashboardData,
}: DashboardRecentSummaryProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {dashboardData.canSeeProduction ? (
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Últimas 5 órdenes de trabajo
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {dashboardData.latestWorkOrders.length === 0 ? (
              <EmptyState label="No hay órdenes de trabajo registradas." />
            ) : (
              dashboardData.latestWorkOrders.map((order) => (
                <div
                  key={order.id_orden_trabajo}
                  className="flex items-start justify-between gap-4 border-b border-border/70 pb-3 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <Link
                      href={`/dashboard/production/work-orders/${order.id_orden_trabajo}`}
                      className="text-sm font-medium text-foreground hover:text-primary"
                    >
                      {order.id_orden_trabajo}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {order.producto.nombre_producto}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.cliente?.nombre_razon_social ??
                        "Sin cliente asociado"}{" "}
                      - Inicio: {formatDate(order.fecha_inicio)}
                    </p>
                  </div>

                  <div className="space-y-2 text-right">
                    <Badge variant="secondary">{order.estado}</Badge>
                    <p className="text-xs text-muted-foreground">
                      {order.prioridad}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {dashboardData.canSeeCommercial ? (
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Últimos 5 pedidos
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {dashboardData.latestOrders.length === 0 ? (
              <EmptyState label="No hay pedidos registrados." />
            ) : (
              dashboardData.latestOrders.map((order) => (
                <div
                  key={order.id_pedido}
                  className="flex items-start justify-between gap-4 border-b border-border/70 pb-3 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {order.id_pedido}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {order.cliente.nombre_razon_social}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(order.fecha_pedido)}
                    </p>
                  </div>

                  <div className="space-y-2 text-right">
                    <Badge variant="secondary">{order.estado}</Badge>
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(order.monto_estimado)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {dashboardData.canSeeInventory ? (
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Materiales críticos
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {dashboardData.criticalMaterials.length === 0 ? (
              <EmptyState label="No hay materiales activos en stock crítico." />
            ) : (
              dashboardData.criticalMaterials.slice(0, 5).map((material) => (
                <div
                  key={material.id_material}
                  className="flex items-start justify-between gap-4 border-b border-border/70 pb-3 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {material.nombre_material}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Mínimo: {formatDecimal(material.stock_minimo)}{" "}
                      {material.unidad_medida}
                    </p>
                  </div>

                  <Badge variant="secondary">
                    {formatDecimal(material.stock_actual)}{" "}
                    {material.unidad_medida}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {dashboardData.canSeePettyCash &&
      dashboardData.latestCashMovements.length > 0 ? (
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Últimos movimientos de caja
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {dashboardData.latestCashMovements.map((movement) => (
              <div
                key={movement.id_movimiento_caja}
                className="flex items-start justify-between gap-4 border-b border-border/70 pb-3 last:border-0 last:pb-0"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {movement.concepto}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {movement.caja_chica.nombre_caja} -{" "}
                    {formatDate(movement.fecha_movimiento)}
                  </p>
                </div>

                <div className="space-y-2 text-right">
                  <Badge variant="secondary">{movement.tipo_movimiento}</Badge>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(movement.monto)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
