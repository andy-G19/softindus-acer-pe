import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { APP_ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { createCostingFromWorkOrderAction } from "@/modules/costs/costings/actions";

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatDecimal(value: unknown) {
  return toNumber(value).toFixed(2);
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
  }).format(value);
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

export default async function CostingWorkOrdersPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const [
    workOrdersWithoutCosting,
    latestCostings,
    totalWorkOrders,
    workOrdersWithoutRecipe,
    workOrdersAlreadyCosted,
    anulledWorkOrders,
  ] = await Promise.all([
    prisma.orden_trabajo.findMany({
      where: {
        estado: {
          not: "anulada",
        },
        id_version_receta: {
          not: null,
        },
        costeo: {
          none: {},
        },
      },
      include: {
        producto: true,
        cliente: true,
        campania_produccion: true,
        ruta_fabricacion: true,
        detalle_pedido: {
          include: {
            pedido: {
              include: {
                cliente: true,
              },
            },
          },
        },
        version_receta: {
          include: {
            receta_tecnica: true,
            _count: {
              select: {
                detalle_receta: true,
              },
            },
          },
        },
      },
      orderBy: {
        fecha_registro: "desc",
      },
    }),

    prisma.costeo.findMany({
      take: 5,
      orderBy: {
        fecha_costeo: "desc",
      },
      include: {
        orden_trabajo: {
          include: {
            producto: true,
          },
        },
        pedido: {
          include: {
            cliente: true,
          },
        },
      },
    }),

    prisma.orden_trabajo.count(),

    prisma.orden_trabajo.count({
      where: {
        estado: {
          not: "anulada",
        },
        id_version_receta: null,
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: {
          not: "anulada",
        },
        costeo: {
          some: {},
        },
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: "anulada",
      },
    }),
  ]);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Costos · Órdenes de trabajo
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Generar costeo desde producción
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Selecciona una orden de trabajo con receta técnica vigente para
            calcular automáticamente el costo estimado de materiales y
            consumibles.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/costs/costings"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Ver costeos
          </Link>

          <Link
            href="/dashboard/costs"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Volver a costos
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Órdenes pendientes</p>
          <p className="mt-2 text-3xl font-bold">
            {workOrdersWithoutCosting.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Con receta y sin costeo
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total de órdenes</p>
          <p className="mt-2 text-3xl font-bold">{totalWorkOrders}</p>
          <p className="mt-1 text-xs text-slate-500">
            Incluye activas y anuladas
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Sin receta técnica</p>
          <p className="mt-2 text-3xl font-bold">{workOrdersWithoutRecipe}</p>
          <p className="mt-1 text-xs text-slate-500">
            Deben completarse en producción
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Ya costeadas / anuladas</p>
          <p className="mt-2 text-3xl font-bold">
            {workOrdersAlreadyCosted} / {anulledWorkOrders}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            No aparecen como pendientes
          </p>
        </div>
      </section>

      {workOrdersWithoutCosting.length === 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="font-semibold">
            No hay órdenes disponibles para costeo
          </p>

          <p className="mt-1">
            Esto puede ocurrir porque no existen órdenes de trabajo, porque las
            órdenes no tienen receta técnica, porque ya fueron costeadas o
            porque están anuladas.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/production/work-orders"
              className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium hover:bg-amber-100"
            >
              Revisar órdenes de producción
            </Link>

            <Link
              href="/dashboard/production/recipes"
              className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium hover:bg-amber-100"
            >
              Revisar recetas técnicas
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-lg font-semibold">
            Órdenes disponibles para costeo
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Solo se muestran órdenes no anuladas, con versión de receta y sin
            costeo previo.
          </p>
        </div>

        {workOrdersWithoutCosting.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            No hay órdenes pendientes de costeo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">Orden</th>
                  <th className="px-5 py-3 font-medium">Producto</th>
                  <th className="px-5 py-3 font-medium">Origen</th>
                  <th className="px-5 py-3 font-medium">Cantidad</th>
                  <th className="px-5 py-3 font-medium">Receta</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Acción</th>
                </tr>
              </thead>

              <tbody>
                {workOrdersWithoutCosting.map((order) => {
                  const origin =
                    order.tipo_produccion === "pedido"
                      ? order.detalle_pedido?.pedido.cliente
                          .nombre_razon_social ??
                        order.cliente?.nombre_razon_social ??
                        "Pedido"
                      : order.tipo_produccion === "campania"
                        ? order.campania_produccion?.nombre_campania ??
                          "Campaña"
                        : "Reposición de stock";

                  const recipeDetailCount =
                    order.version_receta?._count.detalle_receta ?? 0;

                  const canGenerateCosting = recipeDetailCount > 0;

                  return (
                    <tr
                      key={order.id_orden_trabajo}
                      className="border-b last:border-0"
                    >
                      <td className="px-5 py-3 font-mono text-xs">
                        {order.id_orden_trabajo}
                      </td>

                      <td className="px-5 py-3">
                        <div className="font-medium">
                          {order.producto.nombre_producto}
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                          {order.producto.categoria}
                        </p>
                      </td>

                      <td className="px-5 py-3">
                        <div className="font-medium">{origin}</div>
                        <p className="mt-1 text-xs text-slate-500">
                          Tipo: {order.tipo_produccion}
                        </p>
                      </td>

                      <td className="px-5 py-3">
                        {formatDecimal(order.cantidad)}{" "}
                        {order.producto.unidad_medida}
                      </td>

                      <td className="px-5 py-3">
                        {order.version_receta ? (
                          <>
                            <div>
                              {
                                order.version_receta.receta_tecnica
                                  .nombre_receta
                              }
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              Versión: {order.version_receta.numero_version} ·{" "}
                              Materiales: {recipeDetailCount}
                            </p>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="px-5 py-3">
                        {formatDate(order.fecha_inicio)}
                      </td>

                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(
                            order.estado,
                          )}`}
                        >
                          {order.estado}
                        </span>
                      </td>

                      <td className="px-5 py-3">
                        {canGenerateCosting ? (
                          <form action={createCostingFromWorkOrderAction}>
                            <input
                              type="hidden"
                              name="id_orden_trabajo"
                              value={order.id_orden_trabajo}
                            />

                            <button
                              type="submit"
                              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"
                            >
                              Generar costeo
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs text-red-600">
                            Sin materiales
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-lg font-semibold">Costeos recientes</h2>

          <p className="mt-1 text-sm text-slate-500">
            Últimos costeos generados desde órdenes de trabajo o pedidos.
          </p>
        </div>

        {latestCostings.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            Todavía no hay costeos registrados.
          </div>
        ) : (
          <div className="divide-y">
            {latestCostings.map((costing) => {
              const source = costing.orden_trabajo
                ? `${costing.orden_trabajo.id_orden_trabajo} · ${costing.orden_trabajo.producto.nombre_producto}`
                : costing.pedido
                  ? `${costing.pedido.id_pedido} · ${costing.pedido.cliente.nombre_razon_social}`
                  : "Costeo manual";

              return (
                <div
                  key={costing.id_costeo}
                  className="flex flex-col justify-between gap-3 p-5 md:flex-row md:items-center"
                >
                  <div>
                    <p className="font-mono text-xs text-slate-500">
                      {costing.id_costeo}
                    </p>

                    <p className="font-medium">{source}</p>

                    <p className="mt-1 text-sm text-slate-500">
                      Costo total: S/ {toNumber(costing.costo_total).toFixed(2)}
                    </p>
                  </div>

                  <Link
                    href={`/dashboard/costs/costings/${costing.id_costeo}`}
                    className="text-sm font-medium text-slate-700 hover:text-slate-950"
                  >
                    Ver detalle →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        <p className="font-semibold">Validaciones finales activas</p>

        <p className="mt-1">
          Esta pantalla permite identificar si una orden no aparece porque no
          tiene receta técnica, porque ya fue costeada, porque fue anulada o
          porque todavía no existe información productiva suficiente.
        </p>
      </section>
    </main>
  );
}