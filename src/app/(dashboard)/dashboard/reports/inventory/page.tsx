import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";
import { buildReportExportHref } from "@/lib/report-export-link";

const INVENTORY_MOVEMENT_OPTIONS = [
  { value: "entrada", label: "Entrada" },
  { value: "salida", label: "Salida" },
  { value: "ajuste", label: "Ajuste" },
  { value: "reserva", label: "Reserva" },
  { value: "devolucion", label: "Devolución" },
];

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parseDateInput(value: string) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

function parseDateInputAsNextDay(value: string) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day + 1);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatQuantity(value: unknown) {
  return toNumber(value).toFixed(2);
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function getMovementTypeLabel(type: string) {
  return (
    INVENTORY_MOVEMENT_OPTIONS.find((option) => option.value === type)?.label ??
    type
  );
}

type SummaryCardProps = {
  title: string;
  value: string | number;
  description: string;
};

function SummaryCard({ title, value, description }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default async function InventoryReportPage({
  searchParams,
}: PageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = searchParams ? await searchParams : {};

  const dateFrom = getSearchParam(params, "dateFrom");
  const dateTo = getSearchParam(params, "dateTo");
  const materialId = getSearchParam(params, "materialId");
  const movementType = getSearchParam(params, "movementType");
  const userId = getSearchParam(params, "userId");
  const workOrderId = getSearchParam(params, "workOrderId").trim();

  const csvExportHref = buildReportExportHref("inventory", {
    dateFrom,
    dateTo,
    materialId,
    movementType,
    userId,
    workOrderId,
  });

  const pdfExportHref = buildReportExportHref(
  "inventory",
  {
    dateFrom,
    dateTo,
    materialId,
    movementType,
    userId,
    workOrderId,
  },
  "pdf",
);

  const fromDate = parseDateInput(dateFrom);
  const toDate = parseDateInputAsNextDay(dateTo);

  const movementWhere = {
    ...(fromDate || toDate
      ? {
          fecha_movimiento: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lt: toDate } : {}),
          },
        }
      : {}),
    ...(materialId ? { id_material: materialId } : {}),
    ...(movementType ? { tipo_movimiento: movementType } : {}),
    ...(userId ? { id_usuario_responsable: userId } : {}),
    ...(workOrderId
      ? {
          id_orden_trabajo: {
            contains: workOrderId.toUpperCase(),
          },
        }
      : {}),
  };

  const [materials, users, movements] = await Promise.all([
    prisma.material.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_material: "asc",
      },
    }),

    prisma.usuario.findMany({
      where: {
        estado: "activo",
      },
      orderBy: [
        {
          apellidos: "asc",
        },
        {
          nombres: "asc",
        },
      ],
    }),

    prisma.movimiento_inventario.findMany({
      where: movementWhere,
      orderBy: {
        fecha_movimiento: "desc",
      },
      take: 100,
      include: {
        material: true,
        usuario: true,
        orden_trabajo: {
          include: {
            producto: true,
          },
        },
        compra: {
          include: {
            proveedor: true,
          },
        },
      },
    }),
  ]);

  const totalMovements = movements.length;

  const totalEntries = movements.filter((movement) => {
    return movement.tipo_movimiento === "entrada";
  }).length;

  const totalOutputs = movements.filter((movement) => {
    return movement.tipo_movimiento === "salida";
  }).length;

  const totalAdjustments = movements.filter((movement) => {
    return movement.tipo_movimiento === "ajuste";
  }).length;

  const totalReserved = movements.filter((movement) => {
    return movement.tipo_movimiento === "reserva";
  }).length;

  const entryQuantity = movements.reduce((sum, movement) => {
    if (movement.tipo_movimiento !== "entrada") {
      return sum;
    }

    return sum + toNumber(movement.cantidad);
  }, 0);

  const outputQuantity = movements.reduce((sum, movement) => {
    if (movement.tipo_movimiento !== "salida") {
      return sum;
    }

    return sum + toNumber(movement.cantidad);
  }, 0);

  const reservedQuantity = movements.reduce((sum, movement) => {
    if (movement.tipo_movimiento !== "reserva") {
      return sum;
    }

    return sum + toNumber(movement.cantidad);
  }, 0);

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Fase 10 · Subfase 10.3.2
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Reporte de inventario
          </h1>
          <p className="mt-2 max-w-4xl text-muted-foreground">
            Consulta movimientos de inventario por material, tipo de movimiento,
            responsable, fechas y orden de trabajo asociada.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={csvExportHref}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Exportar Excel
          </a>
          <a
            href={pdfExportHref}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
          >
            Exportar PDF
          </a>

          <Link
            href="/dashboard/reports"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Volver al dashboard
          </Link>
        </div>

      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros del reporte</CardTitle>
        </CardHeader>

        <CardContent>
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <label htmlFor="dateFrom" className="text-sm font-medium">
                Fecha desde
              </label>
              <input
                id="dateFrom"
                name="dateFrom"
                type="date"
                defaultValue={dateFrom}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="dateTo" className="text-sm font-medium">
                Fecha hasta
              </label>
              <input
                id="dateTo"
                name="dateTo"
                type="date"
                defaultValue={dateTo}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="materialId" className="text-sm font-medium">
                Material
              </label>
              <select
                id="materialId"
                name="materialId"
                defaultValue={materialId}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los materiales</option>
                {materials.map((material) => (
                  <option key={material.id_material} value={material.id_material}>
                    {material.nombre_material}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="movementType" className="text-sm font-medium">
                Tipo
              </label>
              <select
                id="movementType"
                name="movementType"
                defaultValue={movementType}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los tipos</option>
                {INVENTORY_MOVEMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="userId" className="text-sm font-medium">
                Responsable
              </label>
              <select
                id="userId"
                name="userId"
                defaultValue={userId}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los responsables</option>
                {users.map((user) => (
                  <option key={user.id_usuario} value={user.id_usuario}>
                    {user.apellidos}, {user.nombres}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="workOrderId" className="text-sm font-medium">
                Orden de trabajo
              </label>
              <input
                id="workOrderId"
                name="workOrderId"
                type="text"
                defaultValue={workOrderId}
                placeholder="Ej: OTR00000001"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2 md:col-span-2 xl:col-span-6">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Aplicar filtros
              </button>

              <Link
                href="/dashboard/reports/inventory"
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Limpiar filtros
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          title="Movimientos"
          value={totalMovements}
          description="Total de movimientos encontrados."
        />

        <SummaryCard
          title="Entradas"
          value={totalEntries}
          description={`Cantidad ingresada: ${formatQuantity(entryQuantity)}.`}
        />

        <SummaryCard
          title="Salidas"
          value={totalOutputs}
          description={`Cantidad retirada: ${formatQuantity(outputQuantity)}.`}
        />

        <SummaryCard
          title="Ajustes"
          value={totalAdjustments}
          description="Movimientos correctivos de inventario."
        />

        <SummaryCard
          title="Reservas"
          value={totalReserved}
          description={`Cantidad reservada: ${formatQuantity(reservedQuantity)}.`}
        />

        <SummaryCard
          title="Balance cantidad"
          value={formatQuantity(entryQuantity - outputQuantity)}
          description="Entradas menos salidas del reporte."
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Resultado del reporte
          </CardTitle>
        </CardHeader>

        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron movimientos de inventario con los filtros
              aplicados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Movimiento</th>
                    <th className="py-2 pr-3 font-medium">Material</th>
                    <th className="py-2 pr-3 font-medium">Tipo</th>
                    <th className="py-2 pr-3 font-medium">Cantidad</th>
                    <th className="py-2 pr-3 font-medium">Stock anterior</th>
                    <th className="py-2 pr-3 font-medium">Stock resultante</th>
                    <th className="py-2 pr-3 font-medium">Fecha</th>
                    <th className="py-2 pr-3 font-medium">Responsable</th>
                    <th className="py-2 pr-3 font-medium">Orden</th>
                    <th className="py-2 pr-3 font-medium">Compra</th>
                    <th className="py-2 pr-3 font-medium">Motivo</th>
                  </tr>
                </thead>

                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id_movimiento} className="border-b">
                      <td className="py-2 pr-3 font-medium">
                        {movement.id_movimiento}
                      </td>

                      <td className="py-2 pr-3">
                        <div>
                          <p className="font-medium">
                            {movement.material.nombre_material}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {movement.material.categoria} ·{" "}
                            {movement.material.unidad_medida}
                          </p>
                        </div>
                      </td>

                      <td className="py-2 pr-3">
                        {getMovementTypeLabel(movement.tipo_movimiento)}
                      </td>

                      <td className="py-2 pr-3">
                        {formatQuantity(movement.cantidad)}
                      </td>

                      <td className="py-2 pr-3">
                        {formatQuantity(movement.stock_anterior)}
                      </td>

                      <td className="py-2 pr-3">
                        {formatQuantity(movement.stock_resultante)}
                      </td>

                      <td className="py-2 pr-3">
                        {formatDateTime(movement.fecha_movimiento)}
                      </td>

                      <td className="py-2 pr-3">
                        {movement.usuario.apellidos}, {movement.usuario.nombres}
                      </td>

                      <td className="py-2 pr-3">
                        {movement.orden_trabajo ? (
                          <Link
                            href={`/dashboard/production/work-orders/${movement.orden_trabajo.id_orden_trabajo}`}
                            className="hover:underline"
                          >
                            <span className="font-medium">
                              {movement.orden_trabajo.id_orden_trabajo}
                            </span>
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {
                                movement.orden_trabajo.producto
                                  .nombre_producto
                              }
                            </span>
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="py-2 pr-3">
                        {movement.compra ? (
                          <div>
                            <p className="font-medium">
                              {movement.compra.id_compra}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {movement.compra.proveedor.razon_social}
                            </p>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="py-2 pr-3">
                        {movement.motivo ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Se muestran como máximo 100 movimientos para mantener una consulta
            rápida. En la subfase de exportación se generarán archivos completos
            según los filtros aplicados.
          </p>
        </CardContent>
      </Card>

      <section className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          Este reporte permite auditar la trazabilidad del almacén: cada
          movimiento conserva material, cantidad, stock anterior, stock
          resultante, responsable, fecha y relación con compra u orden de
          trabajo cuando corresponda.
        </p>
      </section>
    </div>
  );
}
