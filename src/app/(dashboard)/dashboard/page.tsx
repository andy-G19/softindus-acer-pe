import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/formatters";
import { getRoleLabel, getUserStatusLabel } from "@/lib/permissions";

const ACTIVE_WORK_ORDER_STATUSES = ["pendiente", "en_proceso", "pausada"];
const PENDING_ORDER_STATUSES = ["registrado", "aprobado", "en producción"];
const RECEIVABLE_QUOTE_STATUSES = ["vigente", "aceptada"];
const PENDING_PURCHASE_PAYMENT_STATUSES = ["pendiente", "parcial"];
const CLOSED_FAILURE_STATUSES = ["cerrada", "reparada"];

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numericValue = Number(value.toString());

  return Number.isNaN(numericValue) ? 0 : numericValue;
}

function formatMoneyValue(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
}

function formatDecimalValue(value: unknown) {
  return toNumber(value).toFixed(2);
}

function KpiCard({
  title,
  value,
  description,
  href,
}: {
  title: string;
  value: string;
  description: string;
  href?: string;
}) {
  const content = (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-1">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground">{label}</p>;
}

async function getDashboardData(role: string) {
  const canSeeCommercial = ["ADMIN", "SELLER"].includes(role);
  const canSeeInventory = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canSeeProduction = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canSeeMaintenance = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canSeeCosts = role === "ADMIN";
  const canSeePettyCash = role === "ADMIN";
  const canSeePurchases = role === "ADMIN";

  const [
    activeWorkOrders,
    latestWorkOrders,
    pendingOrders,
    latestOrders,
    criticalMaterials,
    receivables,
    pettyCashBalance,
    estimatedProfit,
    pendingPurchases,
    activeFailures,
    latestCashMovements,
  ] = await Promise.all([
    canSeeProduction
      ? prisma.orden_trabajo.count({
          where: {
            estado: {
              in: ACTIVE_WORK_ORDER_STATUSES,
            },
          },
        })
      : Promise.resolve(0),
    canSeeProduction
      ? prisma.orden_trabajo.findMany({
          orderBy: {
            fecha_registro: "desc",
          },
          take: 5,
          select: {
            id_orden_trabajo: true,
            estado: true,
            prioridad: true,
            fecha_inicio: true,
            producto: {
              select: {
                nombre_producto: true,
              },
            },
            cliente: {
              select: {
                nombre_razon_social: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    canSeeCommercial
      ? prisma.pedido.count({
          where: {
            estado: {
              in: PENDING_ORDER_STATUSES,
            },
          },
        })
      : Promise.resolve(0),
    canSeeCommercial
      ? prisma.pedido.findMany({
          orderBy: {
            fecha_pedido: "desc",
          },
          take: 5,
          select: {
            id_pedido: true,
            estado: true,
            fecha_pedido: true,
            monto_estimado: true,
            cliente: {
              select: {
                nombre_razon_social: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    canSeeInventory
      ? prisma.material
          .findMany({
            where: {
              estado: true,
            },
            orderBy: {
              nombre_material: "asc",
            },
            select: {
              id_material: true,
              nombre_material: true,
              unidad_medida: true,
              stock_actual: true,
              stock_minimo: true,
            },
          })
          .then((materials) => {
            return materials.filter((material) => {
              return (
                toNumber(material.stock_actual) <= toNumber(material.stock_minimo)
              );
            });
          })
      : Promise.resolve([]),
    canSeeCommercial
      ? prisma.proforma.aggregate({
          where: {
            saldo: {
              gt: 0,
            },
            estado: {
              in: RECEIVABLE_QUOTE_STATUSES,
            },
          },
          _sum: {
            saldo: true,
          },
        })
      : Promise.resolve(null),
    canSeePettyCash
      ? prisma.caja_chica.aggregate({
          where: {
            estado: "abierta",
          },
          _sum: {
            saldo_actual: true,
          },
        })
      : Promise.resolve(null),
    canSeeCosts
      ? prisma.rentabilidad.aggregate({
          _sum: {
            utilidad_estimada: true,
          },
        })
      : Promise.resolve(null),
    canSeePurchases
      ? prisma.compra.count({
          where: {
            estado_pago: {
              in: PENDING_PURCHASE_PAYMENT_STATUSES,
            },
          },
        })
      : Promise.resolve(0),
    canSeeMaintenance
      ? prisma.falla_maquina.count({
          where: {
            estado_atencion: {
              notIn: CLOSED_FAILURE_STATUSES,
            },
          },
        })
      : Promise.resolve(0),
    canSeePettyCash
      ? prisma.movimiento_caja.findMany({
          orderBy: [
            {
              fecha_movimiento: "desc",
            },
            {
              id_movimiento_caja: "desc",
            },
          ],
          take: 5,
          select: {
            id_movimiento_caja: true,
            tipo_movimiento: true,
            concepto: true,
            monto: true,
            fecha_movimiento: true,
            caja_chica: {
              select: {
                nombre_caja: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    activeWorkOrders,
    latestWorkOrders,
    pendingOrders,
    latestOrders,
    criticalMaterials,
    receivables: toNumber(receivables?._sum.saldo),
    pettyCashBalance: toNumber(pettyCashBalance?._sum.saldo_actual),
    estimatedProfit: toNumber(estimatedProfit?._sum.utilidad_estimada),
    pendingPurchases,
    activeFailures,
    latestCashMovements,
    canSeeCommercial,
    canSeeInventory,
    canSeeProduction,
    canSeeMaintenance,
    canSeeCosts,
    canSeePettyCash,
    canSeePurchases,
  };
}

export default async function DashboardPage() {
  const session = await requireAuth();

  const role = session.user.role;
  const dashboardData = await getDashboardData(role);

  const canAccessCommercial = ["ADMIN", "SELLER"].includes(role);
  const canAccessInventory = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canAccessProduction = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canAccessWasteScrap = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canAccessCosts = role === "ADMIN";
  const canAccessPettyCash = role === "ADMIN";
  const canAccessStaff = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canAccessMaintenance = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canAccessReports = role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Bienvenido al panel principal del sistema.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usuario autenticado</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <p className="text-sm">
              <span className="font-medium">Nombre:</span>{" "}
              {session.user.name}
            </p>

            <p className="text-sm">
              <span className="font-medium">Correo:</span>{" "}
              {session.user.email}
            </p>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Rol:</span>
              <Badge>{getRoleLabel(session.user.role)}</Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Estado:</span>
              <Badge variant="secondary">
                {getUserStatusLabel(session.user.status)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seguridad</CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">
              Esta pantalla solo puede visualizarse con una sesion activa.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fase actual</CardTitle>
          </CardHeader>

          <CardContent>
            <Badge variant="secondary">
              Fase 10 - Reportes y dashboard general
            </Badge>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-xl font-semibold">Indicadores operativos</h3>
          <p className="text-sm text-muted-foreground">
            KPIs calculados desde PostgreSQL segun los permisos del rol.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dashboardData.canSeeProduction ? (
            <KpiCard
              title="Ordenes activas"
              value={dashboardData.activeWorkOrders.toString()}
              description="Pendientes, en proceso o pausadas."
              href="/dashboard/production/work-orders"
            />
          ) : null}

          {dashboardData.canSeeCommercial ? (
            <KpiCard
              title="Pedidos pendientes"
              value={dashboardData.pendingOrders.toString()}
              description="Registrados, aprobados o en produccion."
              href="/dashboard/commercial/orders"
            />
          ) : null}

          {dashboardData.canSeeInventory ? (
            <KpiCard
              title="Stock critico"
              value={dashboardData.criticalMaterials.length.toString()}
              description="Materiales activos bajo minimo."
              href="/dashboard/inventory/materials"
            />
          ) : null}

          {dashboardData.canSeeCommercial ? (
            <KpiCard
              title="Cuentas por cobrar"
              value={formatMoneyValue(dashboardData.receivables)}
              description="Saldo vigente o aceptado pendiente."
              href="/dashboard/commercial/quotes"
            />
          ) : null}

          {dashboardData.canSeePettyCash ? (
            <KpiCard
              title="Saldo de caja chica"
              value={formatMoneyValue(dashboardData.pettyCashBalance)}
              description="Suma de cajas abiertas."
              href="/dashboard/petty-cash"
            />
          ) : null}

          {dashboardData.canSeeCosts ? (
            <KpiCard
              title="Utilidad estimada"
              value={formatMoneyValue(dashboardData.estimatedProfit)}
              description="Suma registrada en rentabilidad."
              href="/dashboard/costs"
            />
          ) : null}

          {dashboardData.canSeePurchases ? (
            <KpiCard
              title="Compras pendientes"
              value={dashboardData.pendingPurchases.toString()}
              description="Compras con pago pendiente o parcial."
              href="/dashboard/inventory/purchases"
            />
          ) : null}

          {dashboardData.canSeeMaintenance ? (
            <KpiCard
              title="Fallas activas"
              value={dashboardData.activeFailures.toString()}
              description="Fallas sin cierre operativo."
              href="/dashboard/maintenance/failures"
            />
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-xl font-semibold">Resumen reciente</h3>
          <p className="text-sm text-muted-foreground">
            Movimientos y registros clave visibles para tu rol.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {dashboardData.canSeeProduction ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Ultimas 5 ordenes de trabajo
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {dashboardData.latestWorkOrders.length === 0 ? (
                  <EmptyState label="No hay ordenes de trabajo registradas." />
                ) : (
                  dashboardData.latestWorkOrders.map((order) => (
                    <div
                      key={order.id_orden_trabajo}
                      className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
                    >
                      <div className="space-y-1">
                        <Link
                          href={`/dashboard/production/work-orders/${order.id_orden_trabajo}`}
                          className="text-sm font-medium hover:underline"
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ultimos 5 pedidos</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {dashboardData.latestOrders.length === 0 ? (
                  <EmptyState label="No hay pedidos registrados." />
                ) : (
                  dashboardData.latestOrders.map((order) => (
                    <div
                      key={order.id_pedido}
                      className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
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
                          {formatMoneyValue(order.monto_estimado)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}

          {dashboardData.canSeeInventory ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Materiales criticos</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {dashboardData.criticalMaterials.length === 0 ? (
                  <EmptyState label="No hay materiales activos en stock critico." />
                ) : (
                  dashboardData.criticalMaterials.slice(0, 5).map((material) => (
                    <div
                      key={material.id_material}
                      className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {material.nombre_material}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Minimo: {formatDecimalValue(material.stock_minimo)}{" "}
                          {material.unidad_medida}
                        </p>
                      </div>

                      <Badge variant="secondary">
                        {formatDecimalValue(material.stock_actual)}{" "}
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Ultimos movimientos de caja
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {dashboardData.latestCashMovements.map((movement) => (
                  <div
                    key={movement.id_movimiento_caja}
                    className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {movement.concepto}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {movement.caja_chica.nombre_caja} -{" "}
                        {formatDate(movement.fecha_movimiento)}
                      </p>
                    </div>

                    <div className="space-y-2 text-right">
                      <Badge variant="secondary">
                        {movement.tipo_movimiento}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {formatMoneyValue(movement.monto)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-xl font-semibold">Modulos del sistema</h3>
          <p className="text-sm text-muted-foreground">
            Accede rapidamente a los modulos implementados del sistema.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {canAccessCommercial ? (
            <Link href="/dashboard/commercial" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Modulo comercial
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Clientes, productos, pedidos, proformas, pagos y
                    comprobantes.
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : null}

          {canAccessInventory ? (
            <Link href="/dashboard/inventory" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Inventario y proveedores
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Control de materiales, stock, proveedores, compras y
                    abastecimiento.
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : null}

          {canAccessProduction ? (
            <Link href="/dashboard/production" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Produccion y recetas tecnicas
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Ordenes de trabajo, rutas de fabricacion, etapas, avances y
                    recetas tecnicas.
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : null}

          {canAccessWasteScrap ? (
            <Link href="/dashboard/waste-scrap" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Mermas y chatarra
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Registro de retazos reutilizables, chatarra generada,
                    ventas de chatarra y destino del dinero.
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : null}

          {canAccessCosts ? (
            <Link href="/dashboard/costs" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Costos y rentabilidad
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Costeo de produccion, costos indirectos, margenes, precios
                    sugeridos y utilidad estimada.
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : null}

          {canAccessPettyCash ? (
            <Link href="/dashboard/petty-cash" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Caja chica y finanzas
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Control de caja chica, ingresos menores, egresos,
                    categorias de gasto y resumen financiero mensual.
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : null}

          {canAccessStaff ? (
            <Link href="/dashboard/staff" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Personal, asistencia y pagos
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Operarios, asistencia diaria, tareas, planillas e historial
                    de pagos.
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : null}

          {canAccessMaintenance ? (
            <Link href="/dashboard/maintenance" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Mantenimiento de maquinaria
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Maquinas, fallas, repuestos, reparaciones, preventivos y
                    reincidencias.
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : null}

          {canAccessReports ? (
            <Link href="/dashboard/reports" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Reportes y dashboard general
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Indicadores generales, reportes administrativos y
                    exportacion de datos.
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
