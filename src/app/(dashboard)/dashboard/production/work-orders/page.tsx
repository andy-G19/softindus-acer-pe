import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/notifications/confirm-delete-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  createReturnToHref,
  dashboardBreadcrumbs,
  navigationHrefs,
  withReturnTo,
} from "@/lib/navigation";
import {
  annulWorkOrderAction,
  finishWorkOrderAction,
} from "@/modules/production/work-orders/actions";

type WorkOrdersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
  }).format(value);
}

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

function getOrderBadgeVariant(status: string) {
  if (status === "finalizada") {
    return "success" as const;
  }

  if (status === "en_proceso") {
    return "info" as const;
  }

  if (status === "pausada") {
    return "warning" as const;
  }

  if (status === "anulada") {
    return "destructive" as const;
  }

  return "secondary" as const;
}

function getPriorityBadgeVariant(priority: string) {
  if (priority === "alta") {
    return "destructive" as const;
  }

  if (priority === "media") {
    return "warning" as const;
  }

  return "secondary" as const;
}

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function parseDate(value: string, endOfDay = false) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);

  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function WorkOrdersPage({
  searchParams,
}: WorkOrdersPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const product = getSearchParam(params, "product");
  const client = getSearchParam(params, "client");
  const campaign = getSearchParam(params, "campaign");
  const type = getSearchParam(params, "type");
  const status = getSearchParam(params, "status");
  const priority = getSearchParam(params, "priority");
  const from = getSearchParam(params, "from");
  const to = getSearchParam(params, "to");
  const returnTo = createReturnToHref(navigationHrefs.workOrders, params);
  const fromDate = parseDate(from);
  const toDate = parseDate(to, true);
  const filters: Prisma.orden_trabajoWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          id_orden_trabajo: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          producto: {
            nombre_producto: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
        {
          cliente: {
            nombre_razon_social: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
        {
          detalle_pedido: {
            pedido: {
              cliente: {
                nombre_razon_social: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
          },
        },
      ],
    });
  }

  if (product) {
    filters.push({
      id_producto: product,
    });
  }

  if (client) {
    filters.push({
      OR: [
        {
          id_cliente: client,
        },
        {
          detalle_pedido: {
            pedido: {
              id_cliente: client,
            },
          },
        },
      ],
    });
  }

  if (campaign) {
    filters.push({
      id_campania: campaign,
    });
  }

  if (type) {
    filters.push({
      tipo_produccion: type,
    });
  }

  if (status) {
    filters.push({
      estado: status,
    });
  }

  if (priority) {
    filters.push({
      prioridad: priority,
    });
  }

  if (fromDate || toDate) {
    filters.push({
      fecha_inicio: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      },
    });
  }

  const where: Prisma.orden_trabajoWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [workOrders, products, clients, campaigns] = await Promise.all([
    prisma.orden_trabajo.findMany({
      where,
      include: {
        producto: true,
        cliente: true,
        campania_produccion: true,
        ruta_fabricacion: true,
        version_receta: {
          include: {
            receta_tecnica: true,
          },
        },
        detalle_pedido: {
          include: {
            pedido: {
              include: {
                cliente: true,
              },
            },
          },
        },
        _count: {
          select: {
            avance_orden: true,
            movimiento_inventario: true,
          },
        },
      },
      orderBy: [
        {
          fecha_registro: "desc",
        },
      ],
    }),
    prisma.producto.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_producto: "asc",
      },
      select: {
        id_producto: true,
        nombre_producto: true,
      },
    }),
    prisma.cliente.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_razon_social: "asc",
      },
      select: {
        id_cliente: true,
        nombre_razon_social: true,
      },
    }),
    prisma.campania_produccion.findMany({
      where: {
        estado: {
          in: ["planificada", "activa"],
        },
      },
      orderBy: {
        nombre_campania: "asc",
      },
      select: {
        id_campania: true,
        nombre_campania: true,
      },
    }),
  ]);

  const activeOrders = workOrders.filter((order) =>
    ["pendiente", "en_proceso", "pausada"].includes(order.estado),
  );

  const pendingOrders = workOrders.filter(
    (order) => order.estado === "pendiente",
  );

  const finishedOrders = workOrders.filter(
    (order) => order.estado === "finalizada",
  );

  return (
    <main className="space-y-6">
      <PageHeader
        title="Órdenes de trabajo"
        description="Registra y consulta órdenes de producción por pedido, campaña o reposición de stock."
        backHref={navigationHrefs.production}
        backLabel="Volver a producción"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Órdenes de trabajo" },
        ])}
        actions={
          <Button asChild>
            <Link href="/dashboard/production/work-orders/new">
              Nueva orden
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Órdenes registradas" value={workOrders.length.toString()} description="Total histórico." tone="info" />
        <KpiCard title="Órdenes activas" value={activeOrders.length.toString()} description="Pendientes, en proceso o pausadas." tone="warning" />
        <KpiCard title="Pendientes" value={pendingOrders.length.toString()} description="Sin iniciar todavía." tone="info" />
        <KpiCard title="Finalizadas" value={finishedOrders.length.toString()} description="Órdenes completadas." tone="success" />
      </section>

      <form className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="q">Buscar</Label>
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Buscar orden, cliente o producto..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="product">Producto</Label>
          <NativeSelect id="product" name="product" defaultValue={product}>
            <option value="">Todos los productos</option>
            {products.map((item) => (
              <option key={item.id_producto} value={item.id_producto}>
                {item.nombre_producto}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="client">Cliente</Label>
          <NativeSelect id="client" name="client" defaultValue={client}>
            <option value="">Todos los clientes</option>
            {clients.map((item) => (
              <option key={item.id_cliente} value={item.id_cliente}>
                {item.nombre_razon_social}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="campaign">Campaña</Label>
          <NativeSelect id="campaign" name="campaign" defaultValue={campaign}>
            <option value="">Todas las campañas</option>
            {campaigns.map((item) => (
              <option key={item.id_campania} value={item.id_campania}>
                {item.nombre_campania}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <NativeSelect id="type" name="type" defaultValue={type}>
            <option value="">Todos los tipos</option>
            <option value="pedido">Pedido</option>
            <option value="campania">Campaña</option>
            <option value="reposicion_stock">Reposición de stock</option>
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <NativeSelect id="status" name="status" defaultValue={status}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_proceso">En proceso</option>
            <option value="pausada">Pausada</option>
            <option value="finalizada">Finalizada</option>
            <option value="anulada">Anulada</option>
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Prioridad</Label>
          <NativeSelect id="priority" name="priority" defaultValue={priority}>
            <option value="">Todas las prioridades</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </NativeSelect>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="from">Desde</Label>
            <Input id="from" name="from" type="date" defaultValue={from} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">Hasta</Label>
            <Input id="to" name="to" type="date" defaultValue={to} />
          </div>
        </div>

        <div className="flex items-end gap-2 md:col-span-4">
          <Button type="submit">Filtrar</Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/production/work-orders">
              Limpiar filtros
            </Link>
          </Button>
        </div>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead>Cantidad</TableHead>
            <TableHead>Ruta</TableHead>
            <TableHead>Receta</TableHead>
            <TableHead>Fechas</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {workOrders.map((order) => {
            const origin =
              order.tipo_produccion === "pedido"
                ? order.detalle_pedido?.pedido.cliente.nombre_razon_social ??
                  order.cliente?.nombre_razon_social ??
                  "Pedido"
                : order.tipo_produccion === "campania"
                  ? order.campania_produccion?.nombre_campania ?? "Campaña"
                  : "Reposición de stock";

            const canChangeStatus = !["anulada", "finalizada"].includes(
              order.estado,
            );

            return (
              <TableRow key={order.id_orden_trabajo}>
                <TableCell className="text-xs">
                  {order.id_orden_trabajo}
                </TableCell>

                <TableCell>
                  <div className="font-medium">
                    {order.producto.nombre_producto}
                  </div>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {order.producto.categoria}
                  </p>
                </TableCell>

                <TableCell>
                  <div className="font-medium">{origin}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tipo: {order.tipo_produccion}
                  </p>
                </TableCell>

                <TableCell>
                  {formatDecimal(order.cantidad)} {order.producto.unidad_medida}
                </TableCell>

                <TableCell>
                  {order.ruta_fabricacion?.nombre_ruta ?? "-"}
                </TableCell>

                <TableCell>
                  {order.version_receta ? (
                    <>
                      <div>
                        {order.version_receta.receta_tecnica.nombre_receta}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Versión: {order.version_receta.numero_version}
                      </p>
                    </>
                  ) : (
                    "-"
                  )}
                </TableCell>

                <TableCell>
                  <div>Inicio: {formatDate(order.fecha_inicio)}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Entrega: {formatDate(order.fecha_entrega_estimada)}
                  </p>
                </TableCell>

                <TableCell>
                  <Badge variant={getPriorityBadgeVariant(order.prioridad)}>
                    {order.prioridad}
                  </Badge>
                </TableCell>

                <TableCell>
                  <Badge variant={getOrderBadgeVariant(order.estado)}>
                    {order.estado}
                  </Badge>
                </TableCell>

                <TableCell>
                  <div className="flex flex-col gap-2">
                    <Button variant="link" className="h-auto justify-start p-0" asChild>
                      <Link
                        href={withReturnTo(
                          `${navigationHrefs.workOrders}/${order.id_orden_trabajo}`,
                          returnTo,
                        )}
                      >
                        Ver detalle
                      </Link>
                    </Button>

                    <Button variant="link" className="h-auto justify-start p-0" asChild>
                      <Link
                        href={withReturnTo(
                          `${navigationHrefs.workOrders}/${order.id_orden_trabajo}/progress`,
                          returnTo,
                        )}
                      >
                        Ver avances
                      </Link>
                    </Button>

                    {canChangeStatus ? (
                      <form action={annulWorkOrderAction}>
                        <input
                          type="hidden"
                          name="id_orden_trabajo"
                          value={order.id_orden_trabajo}
                        />
                        <ConfirmDeleteButton
                          title="¿Anular orden de trabajo?"
                          description="Esta acción anulará la orden de trabajo y no se puede deshacer."
                          confirmText="Confirmar anulación"
                          entityName="orden de trabajo"
                          className="rounded-none border-0 bg-transparent px-0 py-0 hover:bg-transparent"
                        >
                          Anular
                        </ConfirmDeleteButton>
                      </form>
                    ) : null}

                    {canChangeStatus && order._count.avance_orden > 0 ? (
                      <form action={finishWorkOrderAction}>
                        <input
                          type="hidden"
                          name="id_orden_trabajo"
                          value={order.id_orden_trabajo}
                        />
                        <Button type="submit" variant="link" className="h-auto justify-start p-0">
                          Finalizar
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}

          {workOrders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay órdenes de trabajo registradas."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </main>
  );
}
