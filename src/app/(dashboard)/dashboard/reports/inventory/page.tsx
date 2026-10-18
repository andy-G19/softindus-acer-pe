import {
  ClipboardList,
  Package,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { DateRangeFields } from "@/components/forms/date-range-fields";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
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
import { formatDateTime } from "@/lib/formatters";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { toNumber } from "@/lib/numbers";
import { APP_ROLES } from "@/lib/permissions";
import { buildReportExportHref } from "@/lib/report-export-link";
import { exceedsReportExportRange, isReportDateRangeInverted } from "@/lib/reports/report-filters";
import {
  getInventoryReportData,
  getInventoryReportFilterOptions,
} from "@/modules/reports/inventory/queries";
import { ExportRangeNotice } from "@/modules/reports/export-range-notice";
import { InvertedRangeNotice } from "@/modules/reports/inverted-range-notice";

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

function formatQuantity(value: unknown) {
  return toNumber(value).toFixed(2);
}

function getMovementTypeLabel(type: string) {
  return (
    INVENTORY_MOVEMENT_OPTIONS.find((option) => option.value === type)?.label ??
    type
  );
}

type ReportFilterValues = Record<
  "dateFrom" | "dateTo" | "materialId" | "movementType" | "userId" | "workOrderId",
  string
>;
type ReportFilterOptions = Awaited<ReturnType<typeof getInventoryReportFilterOptions>>;

// Filtros del reporte. Los pinta tambien la pantalla con el rango de fechas
// invertido, que no consulta los datos (entrega 10.2).
function ReportFilters({
  filters,
  materials,
  users,
}: ReportFilterOptions & { filters: ReportFilterValues }) {
  const { dateFrom, dateTo, materialId, movementType, userId, workOrderId } = filters;

  return (
    <FilterBar
      action="/dashboard/reports/inventory"
      label="Filtros del reporte"
      clearHref="/dashboard/reports/inventory"
      submitLabel="Aplicar filtros"
    >
      <DateRangeFields
        id="fecha"
        fromName="dateFrom"
        toName="dateTo"
        fromLabel="Fecha desde"
        toLabel="Fecha hasta"
        defaultFrom={dateFrom}
        defaultTo={dateTo}
      />

      <Field id="materialId" label="Material">
        {(control) => (
          <NativeSelect {...control} name="materialId" defaultValue={materialId}>
            <option value="">Todos los materiales</option>
            {materials.map((item) => (
              <option key={item.id_material} value={item.id_material}>
                {item.nombre_material}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field id="movementType" label="Tipo">
        {(control) => (
          <NativeSelect {...control} name="movementType" defaultValue={movementType}>
            <option value="">Todos los tipos</option>
            {INVENTORY_MOVEMENT_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field id="userId" label="Responsable">
        {(control) => (
          <NativeSelect {...control} name="userId" defaultValue={userId}>
            <option value="">Todos los responsables</option>
            {users.map((item) => (
              <option key={item.id_usuario} value={item.id_usuario}>
                {item.apellidos}, {item.nombres}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field id="workOrderId" label="Orden de trabajo">
        {(control) => (
          <Input
            {...control}
            name="workOrderId"
            type="text"
            defaultValue={workOrderId}
            placeholder="Ej: OTR00000001"
          />
        )}
      </Field>
    </FilterBar>
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

  const filters = { dateFrom, dateTo, materialId, movementType, userId, workOrderId };
  const pageHeader = {
    title: "Reporte de inventario",
    description: "Consulta movimientos de inventario por material, tipo de movimiento, responsable, fechas y orden de trabajo asociada.",
    breadcrumbs: dashboardBreadcrumbs([
      { label: "Reportes", href: navigationHrefs.reports },
      { label: "Inventario" },
    ]),
  };

  // Con el rango invertido no se consultan los datos ni se ofrece exportar
  // (entrega 10.2): solo las opciones de los filtros y el aviso.
  if (isReportDateRangeInverted(dateFrom, dateTo)) {
    const options = await getInventoryReportFilterOptions();

    return (
      <div className="space-y-6">
        <PageHeader {...pageHeader} />
        <ReportFilters filters={filters} {...options} />
        <InvertedRangeNotice />
      </div>
    );
  }

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

  const { materials, users, movements } = await getInventoryReportData({
    dateFrom,
    dateTo,
    materialId,
    movementType,
    userId,
    workOrderCode: workOrderId.toUpperCase(),
  });

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

  const exportRangeExceeded = exceedsReportExportRange(dateFrom, dateTo);

  return (
    <div className="space-y-6">
      <PageHeader
        {...pageHeader}
        actions={
          exportRangeExceeded ? (
            <ExportRangeNotice />
          ) : (
            <>
              <Button asChild>
                <a href={csvExportHref}>Exportar Excel</a>
              </Button>

              <Button variant="destructive" asChild>
                <a href={pdfExportHref}>Exportar PDF</a>
              </Button>
            </>
          )
        }
      />

      <ReportFilters filters={filters} materials={materials} users={users} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="Movimientos" value={totalMovements.toString()} description="Total de movimientos encontrados." tone="info" icon={ClipboardList} />
        <KpiCard title="Entradas" value={totalEntries.toString()} description={`Cantidad ingresada: ${formatQuantity(entryQuantity)}.`} tone="success" icon={TrendingUp} />
        <KpiCard title="Salidas" value={totalOutputs.toString()} description={`Cantidad retirada: ${formatQuantity(outputQuantity)}.`} tone="warning" icon={TrendingDown} />
        <KpiCard title="Ajustes" value={totalAdjustments.toString()} description="Movimientos correctivos de inventario." tone="info" icon={Scale} />
        <KpiCard title="Reservas" value={totalReserved.toString()} description={`Cantidad reservada: ${formatQuantity(reservedQuantity)}.`} tone="info" icon={Package} />
        <KpiCard title="Balance cantidad" value={formatQuantity(entryQuantity - outputQuantity)} description="Entradas menos salidas del reporte." tone="info" icon={Scale} />
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

