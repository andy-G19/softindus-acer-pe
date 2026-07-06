import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/navigation/page-header";
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

function getStatusClass(status: string) {
  if (status === "finalizada") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "en_proceso") {
    return "bg-blue-50 text-blue-700";
  }

  if (status === "pausada") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "anulada") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function getPriorityClass(priority: string) {
  if (priority === "alta") {
    return "bg-red-50 text-red-700";
  }

  if (priority === "media") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
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
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Órdenes de trabajo" },
        ])}
        actions={
          <Link
            href="/dashboard/production/work-orders/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Nueva orden
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Ordenes registradas</p>
          <p className="mt-2 text-3xl font-bold">{workOrders.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Ordenes activas</p>
          <p className="mt-2 text-3xl font-bold">{activeOrders.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pendientes</p>
          <p className="mt-2 text-3xl font-bold">{pendingOrders.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Finalizadas</p>
          <p className="mt-2 text-3xl font-bold">{finishedOrders.length}</p>
        </div>
      </section>

      <form className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar orden, cliente o producto..."
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />

        <select
          name="product"
          defaultValue={product}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los productos</option>
          {products.map((item) => (
            <option key={item.id_producto} value={item.id_producto}>
              {item.nombre_producto}
            </option>
          ))}
        </select>

        <select
          name="client"
          defaultValue={client}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los clientes</option>
          {clients.map((item) => (
            <option key={item.id_cliente} value={item.id_cliente}>
              {item.nombre_razon_social}
            </option>
          ))}
        </select>

        <select
          name="campaign"
          defaultValue={campaign}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todas las campanias</option>
          {campaigns.map((item) => (
            <option key={item.id_campania} value={item.id_campania}>
              {item.nombre_campania}
            </option>
          ))}
        </select>

        <select
          name="type"
          defaultValue={type}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los tipos</option>
          <option value="pedido">Pedido</option>
          <option value="campania">Campania</option>
          <option value="reposicion_stock">Reposicion de stock</option>
        </select>

        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_proceso">En proceso</option>
          <option value="pausada">Pausada</option>
          <option value="finalizada">Finalizada</option>
          <option value="anulada">Anulada</option>
        </select>

        <select
          name="priority"
          defaultValue={priority}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todas las prioridades</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>

        <div className="grid grid-cols-2 gap-2">
          <input
            name="from"
            type="date"
            defaultValue={from}
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <input
            name="to"
            type="date"
            defaultValue={to}
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="flex gap-2 md:col-span-4">
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Filtrar
          </button>

          <Link
            href="/dashboard/production/work-orders"
            className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Limpiar filtros
          </Link>
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Codigo</th>
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 font-semibold">Origen</th>
              <th className="px-4 py-3 font-semibold">Cantidad</th>
              <th className="px-4 py-3 font-semibold">Ruta</th>
              <th className="px-4 py-3 font-semibold">Receta</th>
              <th className="px-4 py-3 font-semibold">Fechas</th>
              <th className="px-4 py-3 font-semibold">Prioridad</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {workOrders.map((order) => {
              const origin =
                order.tipo_produccion === "pedido"
                  ? order.detalle_pedido?.pedido.cliente.nombre_razon_social ??
                    order.cliente?.nombre_razon_social ??
                    "Pedido"
                  : order.tipo_produccion === "campania"
                    ? order.campania_produccion?.nombre_campania ?? "Campania"
                    : "Reposicion de stock";

              const canChangeStatus = !["anulada", "finalizada"].includes(
                order.estado,
              );

              return (
                <tr key={order.id_orden_trabajo} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">
                    {order.id_orden_trabajo}
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {order.producto.nombre_producto}
                    </div>

                    <p className="mt-1 text-xs text-slate-500 capitalize">
                      {order.producto.categoria}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-medium">{origin}</div>

                    <p className="mt-1 text-xs text-slate-500">
                      Tipo: {order.tipo_produccion}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    {formatDecimal(order.cantidad)}{" "}
                    {order.producto.unidad_medida}
                  </td>

                  <td className="px-4 py-3">
                    {order.ruta_fabricacion?.nombre_ruta ?? "-"}
                  </td>

                  <td className="px-4 py-3">
                    {order.version_receta ? (
                      <>
                        <div>
                          {order.version_receta.receta_tecnica.nombre_receta}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Version: {order.version_receta.numero_version}
                        </p>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div>Inicio: {formatDate(order.fecha_inicio)}</div>
                    <p className="mt-1 text-xs text-slate-500">
                      Entrega: {formatDate(order.fecha_entrega_estimada)}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getPriorityClass(
                        order.prioridad,
                      )}`}
                    >
                      {order.prioridad}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(
                        order.estado,
                      )}`}
                    >
                      {order.estado}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <Link
                        href={withReturnTo(
                          `${navigationHrefs.workOrders}/${order.id_orden_trabajo}`,
                          returnTo,
                        )}
                        className="text-sm font-medium text-slate-600 hover:text-slate-950"
                      >
                        Ver detalle
                      </Link>

                      <Link
                        href={withReturnTo(
                          `${navigationHrefs.workOrders}/${order.id_orden_trabajo}/progress`,
                          returnTo,
                        )}
                        className="text-sm font-medium text-slate-600 hover:text-slate-950"
                      >
                        Ver avances
                      </Link>

                      {canChangeStatus ? (
                        <form action={annulWorkOrderAction}>
                          <input
                            type="hidden"
                            name="id_orden_trabajo"
                            value={order.id_orden_trabajo}
                          />
                          <button
                            type="submit"
                            className="text-left text-sm font-medium text-red-600 hover:text-red-700"
                          >
                            Anular
                          </button>
                        </form>
                      ) : null}

                      {canChangeStatus && order._count.avance_orden > 0 ? (
                        <form action={finishWorkOrderAction}>
                          <input
                            type="hidden"
                            name="id_orden_trabajo"
                            value={order.id_orden_trabajo}
                          />
                          <button
                            type="submit"
                            className="text-left text-sm font-medium text-slate-600 hover:text-slate-950"
                          >
                            Finalizar
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}

            {workOrders.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  Todavia no hay ordenes de trabajo registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div>
        <Link
          href="/dashboard/production"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Volver al modulo de produccion
        </Link>
      </div>
    </main>
  );
}
