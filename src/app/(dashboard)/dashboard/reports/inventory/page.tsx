import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/formatters";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
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

function getMovementTypeLabel(type: string) {
  return (
    INVENTORY_MOVEMENT_OPTIONS.find((option) => option.value === type)?.label ??
    type
  );
}

export default async function InventoryReportPage({
  searchParams,
}: PageProps) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

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
      <PageHeader
        title="Reporte de inventario"
        description="Consulta movimientos de inventario por material, tipo de movimiento, responsable, fechas y orden de trabajo asociada."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Reportes", href: navigationHrefs.reports },
          { label: "Inventario" },
        ])}
        actions={
          <>
            <Button asChild>
              <a href={csvExportHref}>Exportar Excel</a>
            </Button>

            <Button variant="destructive" asChild>
              <a href={pdfExportHref}>Exportar PDF</a>
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros del reporte</CardTitle>
        </CardHeader>

        <CardContent>
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Fecha desde</Label>
              <Input
                id="dateFrom"
                name="dateFrom"
                type="date"
                defaultValue={dateFrom}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">Fecha hasta</Label>
              <Input
                id="dateTo"
                name="dateTo"
                type="date"
                defaultValue={dateTo}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="materialId">Material</Label>
              <NativeSelect id="materialId" name="materialId" defaultValue={materialId}>
                <option value="">Todos los materiales</option>
                {materials.map((material) => (
                  <option key={material.id_material} value={material.id_material}>
                    {material.nombre_material}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="movementType">Tipo</Label>
              <NativeSelect id="movementType" name="movementType" defaultValue={movementType}>
                <option value="">Todos los tipos</option>
                {INVENTORY_MOVEMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userId">Responsable</Label>
              <NativeSelect id="userId" name="userId" defaultValue={userId}>
                <option value="">Todos los responsables</option>
                {users.map((user) => (
                  <option key={user.id_usuario} value={user.id_usuario}>
                    {user.apellidos}, {user.nombres}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workOrderId">Orden de trabajo</Label>
              <Input
                id="workOrderId"
                name="workOrderId"
                type="text"
                defaultValue={workOrderId}
                placeholder="Ej: OTR00000001"
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6">
              <Button type="submit">Aplicar filtros</Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/reports/inventory">
                  Limpiar filtros
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="Movimientos" value={totalMovements.toString()} description="Total de movimientos encontrados." tone="info" />
        <KpiCard title="Entradas" value={totalEntries.toString()} description={`Cantidad ingresada: ${formatQuantity(entryQuantity)}.`} tone="success" />
        <KpiCard title="Salidas" value={totalOutputs.toString()} description={`Cantidad retirada: ${formatQuantity(outputQuantity)}.`} tone="warning" />
        <KpiCard title="Ajustes" value={totalAdjustments.toString()} description="Movimientos correctivos de inventario." tone="info" />
        <KpiCard title="Reservas" value={totalReserved.toString()} description={`Cantidad reservada: ${formatQuantity(reservedQuantity)}.`} tone="info" />
        <KpiCard title="Balance cantidad" value={formatQuantity(entryQuantity - outputQuantity)} description="Entradas menos salidas del reporte." tone="info" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Resultado del reporte
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {movements.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No se encontraron movimientos de inventario con los filtros aplicados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Movimiento</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Stock anterior</TableHead>
                  <TableHead>Stock resultante</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Compra</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.id_movimiento}>
                    <TableCell className="font-medium">
                      {movement.id_movimiento}
                    </TableCell>

                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {movement.material.nombre_material}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {movement.material.categoria} ·{" "}
                          {movement.material.unidad_medida}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      {getMovementTypeLabel(movement.tipo_movimiento)}
                    </TableCell>

                    <TableCell>{formatQuantity(movement.cantidad)}</TableCell>

                    <TableCell>
                      {formatQuantity(movement.stock_anterior)}
                    </TableCell>

                    <TableCell>
                      {formatQuantity(movement.stock_resultante)}
                    </TableCell>

                    <TableCell>
                      {formatDateTime(movement.fecha_movimiento)}
                    </TableCell>

                    <TableCell>
                      {movement.usuario.apellidos}, {movement.usuario.nombres}
                    </TableCell>

                    <TableCell>
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
                    </TableCell>

                    <TableCell>
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
                    </TableCell>

                    <TableCell>{movement.motivo ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <p className="mt-3 px-6 text-xs text-muted-foreground">
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

