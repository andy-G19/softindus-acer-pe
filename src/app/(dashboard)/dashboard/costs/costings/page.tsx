import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { APP_ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/db";

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatMoney(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
}

function formatDecimal(value: unknown) {
  return toNumber(value).toFixed(2);
}

function formatPercent(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${toNumber(value).toFixed(2)}%`;
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function getProfitabilityStatusLabel(alert: boolean) {
  return alert ? "Margen bajo" : "Rentable";
}

function getProfitabilityStatusClass(alert: boolean) {
  return alert
    ? "bg-red-50 text-red-700"
    : "bg-emerald-50 text-emerald-700";
}

function getOriginTypeLabel(type: string | null | undefined) {
  if (type === "pedido") {
    return "Pedido";
  }

  if (type === "campania") {
    return "Campaña";
  }

  if (type === "stock") {
    return "Stock";
  }

  return "Manual";
}

export default async function CostingsPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const costings = await prisma.costeo.findMany({
    orderBy: {
      fecha_costeo: "desc",
    },
    take: 50,
    include: {
      pedido: {
        include: {
          cliente: true,
        },
      },
      orden_trabajo: {
        include: {
          producto: true,
          cliente: true,
          detalle_pedido: {
            include: {
              pedido: {
                include: {
                  cliente: true,
                },
              },
            },
          },
          campania_produccion: true,
        },
      },
      margen_ganancia: {
        orderBy: {
          fecha_aplicacion: "desc",
        },
        take: 1,
      },
      rentabilidad: {
        orderBy: {
          fecha_calculo: "desc",
        },
        take: 1,
      },
    },
  });

  const totalCostings = costings.length;

  const accumulatedCost = costings.reduce((total, item) => {
    return total + toNumber(item.costo_total);
  }, 0);

  const accumulatedProfit = costings.reduce((total, item) => {
    const latestProfitability = item.rentabilidad[0];

    if (!latestProfitability) {
      return total;
    }

    return total + toNumber(latestProfitability.utilidad_estimada);
  }, 0);

  const lowMarginCount = costings.filter((item) => {
    const latestProfitability = item.rentabilidad[0];

    return latestProfitability?.alerta_bajo_margen === true;
  }).length;

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Costos · Costeos registrados
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Detalle de costeos por orden o pedido
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Consulta los costeos generados, su origen productivo o comercial, el
            costo total, margen aplicado, precio final y rentabilidad estimada.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/costs/work-orders"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Generar costeo
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
          <p className="text-sm text-slate-500">Costeos listados</p>
          <p className="mt-2 text-3xl font-bold">{totalCostings}</p>
          <p className="mt-1 text-xs text-slate-500">
            Últimos 50 registros
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Costo acumulado</p>
          <p className="mt-2 text-3xl font-bold">
            {formatMoney(accumulatedCost)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Suma de costos totales
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Utilidad acumulada</p>
          <p className="mt-2 text-3xl font-bold">
            {formatMoney(accumulatedProfit)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Según rentabilidades calculadas
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Alertas de bajo margen</p>
          <p className="mt-2 text-3xl font-bold">{lowMarginCount}</p>
          <p className="mt-1 text-xs text-slate-500">
            Costeos con rentabilidad crítica
          </p>
        </div>
      </section>

      <section className="rounded-xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-lg font-semibold">Costeos registrados</h2>

          <p className="mt-1 text-sm text-slate-500">
            Cada fila muestra el origen del costeo, su costo consolidado y el
            estado económico más reciente.
          </p>
        </div>

        {costings.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            Todavía no hay costeos registrados. Puedes generar uno desde una
            orden de trabajo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">Costeo</th>
                  <th className="px-5 py-3 font-medium">Origen</th>
                  <th className="px-5 py-3 font-medium">Cliente / Pedido</th>
                  <th className="px-5 py-3 font-medium">Cantidad</th>
                  <th className="px-5 py-3 font-medium">Costo total</th>
                  <th className="px-5 py-3 font-medium">Margen</th>
                  <th className="px-5 py-3 font-medium">Precio final</th>
                  <th className="px-5 py-3 font-medium">Utilidad</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Acción</th>
                </tr>
              </thead>

              <tbody>
                {costings.map((costing) => {
                  const workOrder = costing.orden_trabajo;
                  const latestMargin = costing.margen_ganancia[0];
                  const latestProfitability = costing.rentabilidad[0];

                  const originType = workOrder
                    ? getOriginTypeLabel(workOrder.tipo_produccion)
                    : costing.pedido
                      ? "Pedido"
                      : "Manual";

                  const originMain = workOrder
                    ? `${workOrder.id_orden_trabajo} · ${workOrder.producto.nombre_producto}`
                    : costing.pedido
                      ? costing.pedido.id_pedido
                      : "Costeo manual";

                  const originSecondary = workOrder
                    ? `Producto: ${workOrder.producto.categoria}`
                    : costing.pedido
                      ? `Pedido comercial`
                      : "Sin origen asociado";

                  const clientName =
                    workOrder?.detalle_pedido?.pedido.cliente
                      .nombre_razon_social ??
                    workOrder?.cliente?.nombre_razon_social ??
                    costing.pedido?.cliente.nombre_razon_social ??
                    "-";

                  const orderOrPedidoId =
                    workOrder?.detalle_pedido?.id_pedido ??
                    costing.pedido?.id_pedido ??
                    "-";

                  const priceFinal =
                    latestMargin?.precio_final ??
                    latestMargin?.precio_sugerido ??
                    null;

                  return (
                    <tr
                      key={costing.id_costeo}
                      className="border-b last:border-0"
                    >
                      <td className="px-5 py-3">
                        <div className="font-mono text-xs font-medium">
                          {costing.id_costeo}
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(costing.fecha_costeo)}
                        </p>
                      </td>

                      <td className="px-5 py-3">
                        <div className="font-medium">{originMain}</div>

                        <p className="mt-1 text-xs text-slate-500">
                          {originType} · {originSecondary}
                        </p>
                      </td>

                      <td className="px-5 py-3">
                        <div className="font-medium">{clientName}</div>

                        <p className="mt-1 text-xs text-slate-500">
                          Pedido: {orderOrPedidoId}
                        </p>
                      </td>

                      <td className="px-5 py-3">
                        {formatDecimal(costing.cantidad_base)}
                      </td>

                      <td className="px-5 py-3">
                        {formatMoney(costing.costo_total)}
                      </td>

                      <td className="px-5 py-3">
                        {latestMargin
                          ? formatPercent(latestMargin.porcentaje_margen)
                          : "-"}
                      </td>

                      <td className="px-5 py-3">
                        {priceFinal ? formatMoney(priceFinal) : "-"}
                      </td>

                      <td className="px-5 py-3">
                        {latestProfitability
                          ? formatMoney(latestProfitability.utilidad_estimada)
                          : "-"}
                      </td>

                      <td className="px-5 py-3">
                        {latestProfitability ? (
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${getProfitabilityStatusClass(
                              latestProfitability.alerta_bajo_margen,
                            )}`}
                          >
                            {getProfitabilityStatusLabel(
                              latestProfitability.alerta_bajo_margen,
                            )}
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                            Pendiente
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        <Link
                          href={`/dashboard/costs/costings/${costing.id_costeo}`}
                          className="text-sm font-medium text-slate-700 hover:text-slate-950"
                        >
                          Ver detalle →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        <p className="font-semibold">Fase 5.6 implementada</p>

        <p className="mt-1">
          El sistema ahora permite consultar los costeos registrados por orden o
          pedido, revisar su origen, costo consolidado, margen aplicado, precio
          final, utilidad estimada y estado económico.
        </p>
      </section>
    </main>
  );
}