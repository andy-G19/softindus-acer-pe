import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { APP_ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import {
  createIndirectCostAction,
  deleteIndirectCostAction,
} from "@/modules/costs/indirect-costs/actions";
import {
  recalculateCostingAction,
  updateLaborCostAction,
} from "@/modules/costs/costings/actions";
import { createMarginAction } from "@/modules/costs/margins/actions";
import { createProfitabilityAction } from "@/modules/costs/profitability/actions";

type CostingDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

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

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
  }).format(value);
}

function formatShortDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function formatPercent(value: unknown) {
  return `${toNumber(value).toFixed(2)}%`;
}

function getCostTypeLabel(type: string) {
  if (type === "materia_prima") {
    return "Material";
  }

  if (type === "consumible") {
    return "Consumible";
  }

  if (type === "auxiliar") {
    return "Auxiliar";
  }

  return type;
}

function getIndirectCostCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    luz: "Luz",
    desgaste_maquinaria: "Desgaste de maquinaria",
    transporte: "Transporte",
    mantenimiento: "Mantenimiento",
    alquiler: "Alquiler",
    mano_obra_indirecta: "Mano de obra indirecta",
    otros: "Otros",
  };

  return labels[category] ?? category;
}

function getSuggestedPrice(totalCost: unknown, marginPercentage: number) {
  return toNumber(totalCost) * (1 + marginPercentage / 100);
}

function getProfitabilityStatusLabel(alert: boolean) {
  return alert ? "Margen bajo" : "Rentable";
}

function getProfitabilityStatusClass(alert: boolean) {
  return alert
    ? "bg-red-50 text-red-700"
    : "bg-emerald-50 text-emerald-700";
}

function getProfitabilityReference(
  totalCost: unknown,
  price: unknown,
  expectedMargin: unknown,
) {
  const income = toNumber(price);
  const cost = toNumber(totalCost);
  const expected = toNumber(expectedMargin);

  if (income <= 0 || cost <= 0) {
    return {
      income: 0,
      profit: 0,
      realMargin: 0,
      lowMarginAlert: true,
    };
  }

  const profit = income - cost;
  const realMargin = (profit / cost) * 100;
  const lowMarginAlert = realMargin < expected;

  return {
    income,
    profit,
    realMargin,
    lowMarginAlert,
  };
}

export default async function CostingDetailPage({
  params,
}: CostingDetailPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;

  const costing = await prisma.costeo.findUnique({
    where: {
      id_costeo: id,
    },
    include: {
      usuario: true,
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
          version_receta: {
            include: {
              receta_tecnica: true,
              detalle_receta: {
                include: {
                  material: true,
                },
                orderBy: {
                  id_detalle_receta: "asc",
                },
              },
            },
          },
        },
      },
      costo_indirecto: {
        orderBy: {
          fecha_registro: "desc",
        },
      },
      margen_ganancia: {
        orderBy: {
          fecha_aplicacion: "desc",
        },
      },
      rentabilidad: {
        orderBy: {
          fecha_calculo: "desc",
        },
      },
    },
  });

  if (!costing) {
    notFound();
  }

  const workOrder = costing.orden_trabajo;

  const materialRows =
    workOrder?.version_receta?.detalle_receta.map((detail) => {
      const quantityToProduce = toNumber(workOrder.cantidad);
      const quantityPerUnit = toNumber(detail.cantidad_requerida);
      const wastePercentage = toNumber(detail.merma_estimada_porcentaje);
      const unitCost = toNumber(detail.material.costo_unitario_actual);

      const requiredBase = quantityPerUnit * quantityToProduce;
      const requiredWithWaste = requiredBase * (1 + wastePercentage / 100);
      const estimatedCost = requiredWithWaste * unitCost;

      return {
        id: detail.id_detalle_receta,
        materialName: detail.material.nombre_material,
        category: detail.material.categoria,
        consumptionType: detail.tipo_consumo,
        unit: detail.unidad_medida,
        quantityPerUnit,
        requiredBase,
        wastePercentage,
        requiredWithWaste,
        unitCost,
        estimatedCost,
      };
    }) ?? [];

  const latestMargin = costing.margen_ganancia[0];
  const latestProfitability = costing.rentabilidad[0];

  const profitabilityReference = latestMargin
    ? getProfitabilityReference(
        costing.costo_total,
        latestMargin.precio_final ?? latestMargin.precio_sugerido,
        latestMargin.porcentaje_margen,
      )
    : null;

  const sourceLabel = workOrder
    ? `${workOrder.id_orden_trabajo} · ${workOrder.producto.nombre_producto}`
    : costing.pedido
      ? `${costing.pedido.id_pedido} · ${costing.pedido.cliente.nombre_razon_social}`
      : "Costeo manual";

  const clientName =
    workOrder?.detalle_pedido?.pedido.cliente.nombre_razon_social ??
    workOrder?.cliente?.nombre_razon_social ??
    costing.pedido?.cliente.nombre_razon_social ??
    null;

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Costos · Detalle de costeo
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Costeo {costing.id_costeo}
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">{sourceLabel}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/costs/work-orders"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Generar otro costeo
          </Link>

          <Link
            href="/dashboard/costs"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Volver a costos
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Costo materiales</p>
          <p className="mt-2 text-2xl font-bold">
            {formatMoney(costing.costo_materiales)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Costo consumibles</p>
          <p className="mt-2 text-2xl font-bold">
            {formatMoney(costing.costo_consumibles)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Mano de obra</p>
          <p className="mt-2 text-2xl font-bold">
            {formatMoney(costing.costo_mano_obra)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Costo indirecto total</p>
          <p className="mt-2 text-2xl font-bold">
            {formatMoney(costing.costo_indirecto_total)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Costo total</p>
          <p className="mt-2 text-2xl font-bold">
            {formatMoney(costing.costo_total)}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Unitario: {formatMoney(costing.costo_unitario)}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Datos del costeo</h2>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Fecha de costeo</dt>
              <dd className="font-medium">{formatDate(costing.fecha_costeo)}</dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Cantidad base</dt>
              <dd className="font-medium">
                {formatDecimal(costing.cantidad_base)}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Registrado por</dt>
              <dd className="font-medium">
                {costing.usuario.nombres} {costing.usuario.apellidos}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Cliente</dt>
              <dd className="font-medium">{clientName ?? "-"}</dd>
            </div>
          </dl>

          <div className="mt-5 rounded-lg border bg-slate-50 p-4">
            <h3 className="text-sm font-semibold">Mano de obra y recálculo</h3>
            <p className="mt-1 text-xs text-slate-500">
              La mano de obra inicial se estima desde tareas de operario con
              horas y tarifa registradas. Puedes ajustarla manualmente si faltan
              datos operativos.
            </p>

            <form
              action={updateLaborCostAction}
              className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"
            >
              <input
                type="hidden"
                name="id_costeo"
                value={costing.id_costeo}
              />

              <div className="space-y-2">
                <label
                  htmlFor="costo_mano_obra"
                  className="text-xs font-medium text-slate-600"
                >
                  Costo de mano de obra
                </label>

                <input
                  id="costo_mano_obra"
                  name="costo_mano_obra"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={formatDecimal(costing.costo_mano_obra)}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <button
                type="submit"
                className="self-end rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Actualizar
              </button>
            </form>

            <form action={recalculateCostingAction} className="mt-3">
              <input
                type="hidden"
                name="id_costeo"
                value={costing.id_costeo}
              />

              <button
                type="submit"
                className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
              >
                Recalcular costeo
              </button>
            </form>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Estado económico</h2>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Margen aplicado</dt>
              <dd className="font-medium">
                {latestMargin
                  ? formatPercent(latestMargin.porcentaje_margen)
                  : "Pendiente"}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Precio sugerido</dt>
              <dd className="font-medium">
                {latestMargin
                  ? formatMoney(latestMargin.precio_sugerido)
                  : "Pendiente"}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Precio final</dt>
              <dd className="font-medium">
                {latestMargin?.precio_final
                  ? formatMoney(latestMargin.precio_final)
                  : "Pendiente"}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Utilidad estimada</dt>
              <dd className="font-medium">
                {latestProfitability
                  ? formatMoney(latestProfitability.utilidad_estimada)
                  : "Pendiente"}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Margen real</dt>
              <dd className="font-medium">
                {latestProfitability
                  ? formatPercent(latestProfitability.margen_real)
                  : "Pendiente"}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Estado</dt>
              <dd className="font-medium">
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
                  "Pendiente"
                )}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {latestProfitability?.alerta_bajo_margen ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-semibold">Alerta de bajo margen</p>
          <p className="mt-1">
            La última rentabilidad calculada está por debajo del margen
            esperado. Revisa costos, precio final o margen aplicado antes de
            cerrar la evaluación comercial.
          </p>
        </section>
      ) : null}

      <section className="rounded-xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-lg font-semibold">Desglose referencial</h2>

          <p className="mt-1 text-sm text-slate-500">
            Este detalle muestra cómo se calcula el costo desde la receta técnica
            y el costo unitario actual de cada material.
          </p>
        </div>

        {materialRows.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            Este costeo no tiene una orden de trabajo con receta técnica
            asociada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">Material</th>
                  <th className="px-5 py-3 font-medium">Tipo</th>
                  <th className="px-5 py-3 font-medium">Cant. x unidad</th>
                  <th className="px-5 py-3 font-medium">Requerido base</th>
                  <th className="px-5 py-3 font-medium">Merma</th>
                  <th className="px-5 py-3 font-medium">Requerido total</th>
                  <th className="px-5 py-3 font-medium">Costo unitario</th>
                  <th className="px-5 py-3 font-medium">Costo estimado</th>
                </tr>
              </thead>

              <tbody>
                {materialRows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-medium">{row.materialName}</div>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.category}
                      </p>
                    </td>

                    <td className="px-5 py-3">
                      {getCostTypeLabel(row.consumptionType)}
                    </td>

                    <td className="px-5 py-3">
                      {formatDecimal(row.quantityPerUnit)} {row.unit}
                    </td>

                    <td className="px-5 py-3">
                      {formatDecimal(row.requiredBase)} {row.unit}
                    </td>

                    <td className="px-5 py-3">
                      {formatPercent(row.wastePercentage)}
                    </td>

                    <td className="px-5 py-3">
                      {formatDecimal(row.requiredWithWaste)} {row.unit}
                    </td>

                    <td className="px-5 py-3">{formatMoney(row.unitCost)}</td>

                    <td className="px-5 py-3 font-medium">
                      {formatMoney(row.estimatedCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Registrar costo indirecto</h2>

          <p className="mt-1 text-sm text-slate-500">
            Agrega gastos indirectos relacionados con este costeo. El sistema
            recalculará automáticamente el costo indirecto total, el costo total
            y el costo unitario.
          </p>

          <form action={createIndirectCostAction} className="mt-5 space-y-4">
            <input type="hidden" name="id_costeo" value={costing.id_costeo} />

            <div className="space-y-2">
              <label htmlFor="concepto" className="text-sm font-medium">
                Concepto
              </label>

              <input
                id="concepto"
                name="concepto"
                type="text"
                required
                maxLength={100}
                placeholder="Ejemplo: Consumo de luz del lote"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="categoria" className="text-sm font-medium">
                  Categoría
                </label>

                <select
                  id="categoria"
                  name="categoria"
                  required
                  defaultValue="luz"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="luz">Luz</option>
                  <option value="desgaste_maquinaria">
                    Desgaste de maquinaria
                  </option>
                  <option value="transporte">Transporte</option>
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="alquiler">Alquiler</option>
                  <option value="mano_obra_indirecta">
                    Mano de obra indirecta
                  </option>
                  <option value="otros">Otros</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="monto" className="text-sm font-medium">
                  Monto
                </label>

                <input
                  id="monto"
                  name="monto"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="criterio_prorrateo"
                  className="text-sm font-medium"
                >
                  Criterio de prorrateo
                </label>

                <input
                  id="criterio_prorrateo"
                  name="criterio_prorrateo"
                  type="text"
                  maxLength={100}
                  placeholder="Ejemplo: Prorrateado por lote"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="periodo" className="text-sm font-medium">
                  Periodo
                </label>

                <input
                  id="periodo"
                  name="periodo"
                  type="text"
                  maxLength={30}
                  placeholder="Ejemplo: 2026-06"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="observaciones" className="text-sm font-medium">
                Observaciones
              </label>

              <textarea
                id="observaciones"
                name="observaciones"
                rows={3}
                placeholder="Detalle adicional del costo indirecto registrado."
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Registrar costo indirecto
            </button>
          </form>
        </div>

        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold">
              Costos indirectos registrados
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Historial de gastos indirectos asociados al costeo.
            </p>
          </div>

          {costing.costo_indirecto.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">
              Todavía no hay costos indirectos registrados para este costeo.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-left">
                  <tr>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Concepto</th>
                    <th className="px-5 py-3 font-medium">Categoría</th>
                    <th className="px-5 py-3 font-medium">Periodo</th>
                    <th className="px-5 py-3 text-right font-medium">Monto</th>
                    <th className="px-5 py-3 text-right font-medium">
                      Accion
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {costing.costo_indirecto.map((item) => (
                    <tr
                      key={item.id_costo_indirecto}
                      className="border-b last:border-0"
                    >
                      <td className="px-5 py-3">
                        {formatShortDate(item.fecha_registro)}
                      </td>

                      <td className="px-5 py-3">
                        <div className="font-medium">{item.concepto}</div>

                        {item.criterio_prorrateo ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {item.criterio_prorrateo}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-5 py-3">
                        {getIndirectCostCategoryLabel(item.categoria)}
                      </td>

                      <td className="px-5 py-3">{item.periodo ?? "-"}</td>

                      <td className="px-5 py-3 text-right font-medium">
                        {formatMoney(item.monto)}
                      </td>

                      <td className="px-5 py-3 text-right">
                        <form action={deleteIndirectCostAction}>
                          <input
                            type="hidden"
                            name="id_costo_indirecto"
                            value={item.id_costo_indirecto}
                          />

                          <button
                            type="submit"
                            className="text-xs font-medium text-red-600 hover:text-red-800"
                          >
                            Eliminar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Aplicar margen de ganancia</h2>

          <p className="mt-1 text-sm text-slate-500">
            Aplica un margen entre 15% y 20% sobre el costo total. El sistema
            calculará automáticamente el precio sugerido y permitirá registrar
            un precio final ajustado.
          </p>

          <div className="mt-4 rounded-lg border bg-slate-50 p-4 text-sm">
            <p className="font-medium">Referencia rápida</p>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-slate-500">Costo total</p>
                <p className="font-semibold">
                  {formatMoney(costing.costo_total)}
                </p>
              </div>

              <div>
                <p className="text-slate-500">Precio con 15%</p>
                <p className="font-semibold">
                  {formatMoney(getSuggestedPrice(costing.costo_total, 15))}
                </p>
              </div>

              <div>
                <p className="text-slate-500">Precio con 20%</p>
                <p className="font-semibold">
                  {formatMoney(getSuggestedPrice(costing.costo_total, 20))}
                </p>
              </div>
            </div>
          </div>

          <form action={createMarginAction} className="mt-5 space-y-4">
            <input type="hidden" name="id_costeo" value={costing.id_costeo} />

            <div className="space-y-2">
              <label
                htmlFor="porcentaje_margen"
                className="text-sm font-medium"
              >
                Margen de ganancia
              </label>

              <select
                id="porcentaje_margen"
                name="porcentaje_margen"
                required
                defaultValue="15"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="15">15%</option>
                <option value="16">16%</option>
                <option value="17">17%</option>
                <option value="18">18%</option>
                <option value="19">19%</option>
                <option value="20">20%</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="precio_final" className="text-sm font-medium">
                Precio final ajustado
              </label>

              <input
                id="precio_final"
                name="precio_final"
                type="number"
                min="0"
                step="0.01"
                placeholder="Opcional. Si lo dejas vacío, se usará el precio sugerido."
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />

              <p className="text-xs text-slate-500">
                Usa este campo si el administrador decide ajustar manualmente el
                precio por negociación, redondeo o estrategia comercial.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="motivo_ajuste" className="text-sm font-medium">
                Motivo de ajuste
              </label>

              <textarea
                id="motivo_ajuste"
                name="motivo_ajuste"
                rows={3}
                placeholder="Ejemplo: Se redondea el precio final por negociación con el cliente."
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Aplicar margen
            </button>
          </form>
        </div>

        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold">Márgenes aplicados</h2>

            <p className="mt-1 text-sm text-slate-500">
              Historial de márgenes registrados para este costeo.
            </p>
          </div>

          {costing.margen_ganancia.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">
              Todavía no hay márgenes aplicados para este costeo.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-left">
                  <tr>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Margen</th>
                    <th className="px-5 py-3 font-medium">Precio sugerido</th>
                    <th className="px-5 py-3 font-medium">Precio final</th>
                    <th className="px-5 py-3 font-medium">Motivo</th>
                  </tr>
                </thead>

                <tbody>
                  {costing.margen_ganancia.map((item) => (
                    <tr key={item.id_margen} className="border-b last:border-0">
                      <td className="px-5 py-3">
                        {formatShortDate(item.fecha_aplicacion)}
                      </td>

                      <td className="px-5 py-3">
                        {formatPercent(item.porcentaje_margen)}
                      </td>

                      <td className="px-5 py-3">
                        {formatMoney(item.precio_sugerido)}
                      </td>

                      <td className="px-5 py-3">
                        {item.precio_final
                          ? formatMoney(item.precio_final)
                          : "-"}
                      </td>

                      <td className="px-5 py-3">
                        {item.motivo_ajuste ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Calcular rentabilidad</h2>

          <p className="mt-1 text-sm text-slate-500">
            Calcula la utilidad estimada comparando el ingreso esperado contra
            el costo total del costeo.
          </p>

          {!latestMargin ? (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Primero debes aplicar un margen de ganancia para obtener un precio
              sugerido o precio final.
            </div>
          ) : (
            <>
              <div className="mt-4 rounded-lg border bg-slate-50 p-4 text-sm">
                <p className="font-medium">Vista previa de rentabilidad</p>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-slate-500">Ingreso estimado</p>
                    <p className="font-semibold">
                      {formatMoney(profitabilityReference?.income)}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">Costo total</p>
                    <p className="font-semibold">
                      {formatMoney(costing.costo_total)}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">Utilidad estimada</p>
                    <p className="font-semibold">
                      {formatMoney(profitabilityReference?.profit)}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">Margen real</p>
                    <p className="font-semibold">
                      {formatPercent(profitabilityReference?.realMargin)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${getProfitabilityStatusClass(
                      Boolean(profitabilityReference?.lowMarginAlert),
                    )}`}
                  >
                    {getProfitabilityStatusLabel(
                      Boolean(profitabilityReference?.lowMarginAlert),
                    )}
                  </span>
                </div>
              </div>

              <form
                action={createProfitabilityAction}
                className="mt-5 space-y-4"
              >
                <input
                  type="hidden"
                  name="id_costeo"
                  value={costing.id_costeo}
                />

                <div className="space-y-2">
                  <label
                    htmlFor="observaciones_rentabilidad"
                    className="text-sm font-medium"
                  >
                    Observaciones
                  </label>

                  <textarea
                    id="observaciones_rentabilidad"
                    name="observaciones"
                    rows={3}
                    placeholder="Ejemplo: Rentabilidad aceptable según margen comercial aplicado."
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Calcular rentabilidad
                </button>
              </form>
            </>
          )}
        </div>

        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold">
              Historial de rentabilidad
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Últimos cálculos de utilidad y margen real asociados al costeo.
            </p>
          </div>

          {costing.rentabilidad.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">
              Todavía no hay cálculos de rentabilidad registrados para este
              costeo.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-left">
                  <tr>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Ingreso</th>
                    <th className="px-5 py-3 font-medium">Costo</th>
                    <th className="px-5 py-3 font-medium">Utilidad</th>
                    <th className="px-5 py-3 font-medium">Margen real</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {costing.rentabilidad.map((item) => (
                    <tr
                      key={item.id_rentabilidad}
                      className="border-b last:border-0"
                    >
                      <td className="px-5 py-3">
                        {formatShortDate(item.fecha_calculo)}
                      </td>

                      <td className="px-5 py-3">
                        {formatMoney(item.ingreso_estimado)}
                      </td>

                      <td className="px-5 py-3">
                        {formatMoney(item.costo_total)}
                      </td>

                      <td className="px-5 py-3">
                        {formatMoney(item.utilidad_estimada)}
                      </td>

                      <td className="px-5 py-3">
                        {formatPercent(item.margen_real)}
                      </td>

                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${getProfitabilityStatusClass(
                            item.alerta_bajo_margen,
                          )}`}
                        >
                          {getProfitabilityStatusLabel(
                            item.alerta_bajo_margen,
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        <p className="font-semibold">Fase 5.5 implementada</p>

        <p className="mt-1">
          El sistema ya calcula rentabilidad, utilidad estimada, margen real y
          alerta de bajo margen usando el último margen de ganancia aplicado. En
          la siguiente subfase consolidaremos el detalle económico final del
          costeo.
        </p>
      </section>
    </main>
  );
}
