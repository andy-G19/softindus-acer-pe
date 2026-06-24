import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/access-denied");
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

export default async function WorkOrdersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const workOrders = await prisma.orden_trabajo.findMany({
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
  });

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
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Producción · Órdenes de trabajo
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Órdenes de trabajo
          </h1>

          <p className="max-w-3xl text-slate-600">
            Registra y consulta órdenes de producción por pedido, campaña o
            reposición de stock.
          </p>
        </div>

        <Link
          href="/dashboard/production/work-orders/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nueva orden
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Órdenes registradas</p>
          <p className="mt-2 text-3xl font-bold">{workOrders.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Órdenes activas</p>
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

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 font-semibold">Origen</th>
              <th className="px-4 py-3 font-semibold">Cantidad</th>
              <th className="px-4 py-3 font-semibold">Ruta</th>
              <th className="px-4 py-3 font-semibold">Receta</th>
              <th className="px-4 py-3 font-semibold">Fechas</th>
              <th className="px-4 py-3 font-semibold">Prioridad</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Acción</th>
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
                    ? order.campania_produccion?.nombre_campania ?? "Campaña"
                    : "Reposición de stock";

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
                          Versión: {order.version_receta.numero_version}
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
                      href={`/dashboard/production/work-orders/${order.id_orden_trabajo}`}
                      className="text-sm font-medium text-slate-600 hover:text-slate-950"
                    >
                      Ver detalle
                    </Link>
                                
                    <Link
                      href={`/dashboard/production/work-orders/${order.id_orden_trabajo}/progress`}
                      className="text-sm font-medium text-slate-600 hover:text-slate-950"
                    >
                      Ver avances
                    </Link>
                  </div>
                </td>
                </tr>
              );
            })}

            {workOrders.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  Todavía no hay órdenes de trabajo registradas.
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
          ← Volver al módulo de producción
        </Link>
      </div>
    </main>
  );
}