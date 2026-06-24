import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

type WorkOrderDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/access-denied");
  }
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatDecimal(value: unknown) {
  return toNumber(value).toFixed(2);
}

function formatMoney(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
  }).format(value);
}

function calculateRequiredWithWaste(baseQuantity: number, wastePercentage: number) {
  return baseQuantity * (1 + wastePercentage / 100);
}

function getStockStatusClass(hasEnoughStock: boolean) {
  if (hasEnoughStock) {
    return "bg-emerald-50 text-emerald-700";
  }

  return "bg-red-50 text-red-700";
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

export default async function WorkOrderDetailPage({
  params,
}: WorkOrderDetailPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const { id } = await params;

  const workOrder = await prisma.orden_trabajo.findUnique({
    where: {
      id_orden_trabajo: id,
    },
    include: {
      producto: true,
      cliente: true,
      usuario: true,
      campania_produccion: true,
      ruta_fabricacion: {
        include: {
          etapa_ruta: {
            where: {
              estado: true,
            },
            orderBy: {
              orden_secuencia: "asc",
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
      detalle_pedido: {
        include: {
          pedido: {
            include: {
              cliente: true,
            },
          },
        },
      },
      avance_orden: true,
      movimiento_inventario: true,
    },
  });

  if (!workOrder) {
    notFound();
  }

  const materialRows =
    workOrder.version_receta?.detalle_receta.map((detail) => {
      const quantityToProduce = toNumber(workOrder.cantidad);
      const baseQuantityPerUnit = toNumber(detail.cantidad_requerida);
      const wastePercentage = toNumber(detail.merma_estimada_porcentaje);

      const requiredWithoutWaste = baseQuantityPerUnit * quantityToProduce;
      const requiredWithWaste = calculateRequiredWithWaste(
        requiredWithoutWaste,
        wastePercentage,
      );

      const currentStock = toNumber(detail.material.stock_actual);
      const reservedStock = toNumber(detail.material.stock_reservado);
      const availableStock = currentStock - reservedStock;

      const shortage = Math.max(requiredWithWaste - availableStock, 0);
      const hasEnoughStock = availableStock >= requiredWithWaste;

      const unitCost = toNumber(detail.material.costo_unitario_actual);
      const estimatedCost = requiredWithWaste * unitCost;

      return {
        id: detail.id_detalle_receta,
        materialName: detail.material.nombre_material,
        materialCategory: detail.material.categoria,
        unit: detail.unidad_medida,
        materialUnit: detail.material.unidad_medida,
        consumptionType: detail.tipo_consumo,
        baseQuantityPerUnit,
        requiredWithoutWaste,
        wastePercentage,
        requiredWithWaste,
        currentStock,
        reservedStock,
        availableStock,
        shortage,
        hasEnoughStock,
        estimatedCost,
      };
    }) ?? [];

  const totalEstimatedCost = materialRows.reduce(
    (total, row) => total + row.estimatedCost,
    0,
  );

  const criticalMaterials = materialRows.filter(
    (row) => !row.hasEnoughStock,
  );

  const origin =
    workOrder.tipo_produccion === "pedido"
      ? workOrder.detalle_pedido?.pedido.cliente.nombre_razon_social ??
        workOrder.cliente?.nombre_razon_social ??
        "Pedido"
      : workOrder.tipo_produccion === "campania"
        ? workOrder.campania_produccion?.nombre_campania ?? "Campaña"
        : "Reposición de stock";

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Producción · Órdenes de trabajo
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Orden {workOrder.id_orden_trabajo}
          </h1>


          <p className="mt-2 max-w-3xl text-slate-600">
            Producto:{" "}
            <span className="font-medium">
              {workOrder.producto.nombre_producto}
            </span>{" "}
            · Cantidad:{" "}
            <span className="font-medium">
              {formatDecimal(workOrder.cantidad)}{" "}
              {workOrder.producto.unidad_medida}
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/dashboard/production/work-orders/${workOrder.id_orden_trabajo}/progress`}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver avances
          </Link>
        
          <span
            className={`rounded-full px-3 py-2 text-sm font-medium ${getStatusClass(
              workOrder.estado,
            )}`}
          >
            {workOrder.estado}
          </span>
        </div>

      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Origen</p>
          <p className="mt-2 text-xl font-bold">{origin}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Inicio</p>
          <p className="mt-2 text-xl font-bold">
            {formatDate(workOrder.fecha_inicio)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Entrega estimada</p>
          <p className="mt-2 text-xl font-bold">
            {formatDate(workOrder.fecha_entrega_estimada)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Costo material estimado</p>
          <p className="mt-2 text-xl font-bold">
            {formatMoney(totalEstimatedCost)}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Ruta de fabricación</h2>

          <p className="mt-2 text-sm text-slate-600">
            {workOrder.ruta_fabricacion?.nombre_ruta ?? "Sin ruta asociada"}
          </p>

          <div className="mt-4 space-y-3">
            {workOrder.ruta_fabricacion?.etapa_ruta.map((stage) => (
              <div
                key={stage.id_etapa_ruta}
                className="rounded-lg border bg-slate-50 p-3 text-sm"
              >
                <p className="font-medium">
                  {stage.orden_secuencia}. {stage.nombre_etapa}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {stage.requiere_maquina
                    ? "Requiere máquina"
                    : "No requiere máquina"}
                </p>
              </div>
            ))}

            {workOrder.ruta_fabricacion?.etapa_ruta.length === 0 ? (
              <p className="text-sm text-slate-500">
                Esta ruta no tiene etapas activas.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Receta técnica</h2>

          <p className="mt-2 text-sm text-slate-600">
            {workOrder.version_receta?.receta_tecnica.nombre_receta ??
              "Sin receta asociada"}
          </p>

          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="font-medium">Versión:</span>{" "}
              {workOrder.version_receta?.numero_version ?? "-"}
            </p>

            <p>
              <span className="font-medium">Materiales:</span>{" "}
              {workOrder.version_receta?.detalle_receta.length ?? 0}
            </p>

            <p>
              <span className="font-medium">Registrada por:</span>{" "}
              {workOrder.usuario.nombres} {workOrder.usuario.apellidos}
            </p>

            {workOrder.observaciones ? (
              <p className="pt-2 text-slate-600">{workOrder.observaciones}</p>
            ) : null}
          </div>
        </div>
      </section>

      {criticalMaterials.length > 0 ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Hay {criticalMaterials.length} material(es) sin stock suficiente para
          esta orden. Revisa la columna de faltante antes de iniciar la
          producción.
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-4 py-3">
          <h2 className="font-semibold">Materiales requeridos para la orden</h2>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Material</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Cant. por unidad</th>
              <th className="px-4 py-3 font-semibold">Requerido total</th>
              <th className="px-4 py-3 font-semibold">Stock disponible</th>
              <th className="px-4 py-3 font-semibold">Faltante</th>
              <th className="px-4 py-3 font-semibold">Costo estimado</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>

          <tbody>
            {materialRows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{row.materialName}</div>
                  <p className="mt-1 text-xs text-slate-500">
                    Categoría: {row.materialCategory}
                  </p>
                </td>

                <td className="px-4 py-3 capitalize">
                  {row.consumptionType}
                </td>

                <td className="px-4 py-3">
                  {formatDecimal(row.baseQuantityPerUnit)} {row.unit}
                </td>

                <td className="px-4 py-3 font-medium">
                  {formatDecimal(row.requiredWithWaste)} {row.unit}
                  <p className="mt-1 text-xs text-slate-400">
                    Incluye merma: {formatDecimal(row.wastePercentage)}%
                  </p>
                </td>

                <td className="px-4 py-3">
                  {formatDecimal(row.availableStock)} {row.materialUnit}
                  <p className="mt-1 text-xs text-slate-400">
                    Stock: {formatDecimal(row.currentStock)} · Reservado:{" "}
                    {formatDecimal(row.reservedStock)}
                  </p>
                </td>

                <td className="px-4 py-3">
                  {formatDecimal(row.shortage)} {row.materialUnit}
                </td>

                <td className="px-4 py-3 font-medium">
                  {formatMoney(row.estimatedCost)}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${getStockStatusClass(
                      row.hasEnoughStock,
                    )}`}
                  >
                    {row.hasEnoughStock ? "Suficiente" : "Insuficiente"}
                  </span>
                </td>
              </tr>
            ))}

            {materialRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Esta orden no tiene materiales calculados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div className="rounded-xl border bg-slate-50 p-5 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Siguiente paso</p>

        <p className="mt-1">
          En la Fase 4.8 generaremos los avances de producción por cada etapa de
          la ruta. Ahí podrás marcar etapas como pendiente, en proceso, pausada o
          terminada.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/production/work-orders"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Volver a órdenes
        </Link>

        <Link
          href="/dashboard/production"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Volver al módulo producción
        </Link>
      </div>
    </main>
  );
}