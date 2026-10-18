import {
  ClipboardList,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Users,
} from "lucide-react";
import { DateRangeFields } from "@/components/forms/date-range-fields";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
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
import { APP_ROLES } from "@/lib/permissions";
import { isReportDateRangeInverted } from "@/lib/reports/report-filters";
import {
  getExportHistoryData,
  getExportHistoryFilterOptions,
} from "@/modules/reports/export-history/queries";
import { InvertedRangeNotice } from "@/modules/reports/inverted-range-notice";

const REPORT_MODULE_OPTIONS = [
  "Reporte de producción",
  "Reporte de inventario",
  "Reporte de ventas y cobranzas",
  "Reporte de proveedores y compras",
  "Reporte financiero",
  "Reporte de mantenimiento",
  "Reporte de costos y rentabilidad",
  "Reporte de personal y planillas",
  "Reporte de auditoria",
];

const FORMAT_OPTIONS = [
  { value: "excel", label: "Excel" },
  { value: "pdf", label: "PDF" },
];

const STATUS_OPTIONS = [
  { value: "generada", label: "Generada" },
  { value: "fallida", label: "Fallida" },
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

function getFormatLabel(format: string) {
  return FORMAT_OPTIONS.find((option) => option.value === format)?.label ?? format;
}

function getStatusLabel(status: string) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function formatParams(value: string | null) {
  if (!value || value === "{}") {
    return "Sin filtros";
  }

  try {
    const parsed = JSON.parse(value) as Record<string, string>;

    const entries = Object.entries(parsed).filter(([, entryValue]) => {
      return Boolean(entryValue);
    });

    if (entries.length === 0) {
      return "Sin filtros";
    }

    return entries
      .map(([key, entryValue]) => {
        return `${key}: ${entryValue}`;
      })
      .join(" | ");
  } catch {
    return value;
  }
}

type ReportFilterValues = Record<
  "dateFrom" | "dateTo" | "reportModule" | "format" | "status" | "userId" | "searchText",
  string
>;
type ReportFilterOptions = Awaited<ReturnType<typeof getExportHistoryFilterOptions>>;

// Filtros del reporte. Los pinta tambien la pantalla con el rango de fechas
// invertido, que no consulta los datos (entrega 10.2).
function ReportFilters({
  filters,
  users,
}: ReportFilterOptions & { filters: ReportFilterValues }) {
  const { dateFrom, dateTo, reportModule, format, status, userId, searchText } = filters;

  return (
    <FilterBar
      action="/dashboard/reports/export-history"
      label="Filtros del historial"
      clearHref="/dashboard/reports/export-history"
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

      <Field id="module" label="Reporte">
        {(control) => (
          <NativeSelect {...control} name="module" defaultValue={reportModule}>
            <option value="">Todos los reportes</option>
            {REPORT_MODULE_OPTIONS.map((moduleOption) => (
              <option key={moduleOption} value={moduleOption}>
                {moduleOption}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field id="format" label="Formato">
        {(control) => (
          <NativeSelect {...control} name="format" defaultValue={format}>
            <option value="">Todos los formatos</option>
            {FORMAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field id="status" label="Estado">
        {(control) => (
          <NativeSelect {...control} name="status" defaultValue={status}>
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field id="userId" label="Usuario">
        {(control) => (
          <NativeSelect {...control} name="userId" defaultValue={userId}>
            <option value="">Todos los usuarios</option>
            {users.map((user) => (
              <option key={user.id_usuario} value={user.id_usuario}>
                {user.apellidos}, {user.nombres}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field id="searchText" label="Buscar">
        {(control) => (
          <Input
            {...control}
            name="searchText"
            type="text"
            defaultValue={searchText}
            placeholder="Archivo, filtros..."
          />
        )}
      </Field>
    </FilterBar>
  );
}

export default async function ExportHistoryPage({ searchParams }: PageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = searchParams ? await searchParams : {};

  const dateFrom = getSearchParam(params, "dateFrom");
  const dateTo = getSearchParam(params, "dateTo");
  const reportModule = getSearchParam(params, "module");
  const format = getSearchParam(params, "format");
  const status = getSearchParam(params, "status");
  const userId = getSearchParam(params, "userId");
  const searchText = getSearchParam(params, "searchText").trim();

  const filters = { dateFrom, dateTo, reportModule, format, status, userId, searchText };
  const pageHeader = {
    title: "Historial de exportaciones",
    description: "Consulta la trazabilidad de reportes exportados: usuario, módulo, formato, filtros aplicados, fecha y archivo generado.",
    breadcrumbs: dashboardBreadcrumbs([
      { label: "Reportes", href: navigationHrefs.reports },
      { label: "Historial de exportaciones" },
    ]),
  };

  // Con el rango invertido no se consultan los datos ni se ofrece exportar
  // (entrega 10.2): solo las opciones de los filtros y el aviso.
  if (isReportDateRangeInverted(dateFrom, dateTo)) {
    const options = await getExportHistoryFilterOptions();

    return (
      <div className="space-y-6">
        <PageHeader {...pageHeader} />
        <ReportFilters filters={filters} {...options} />
        <InvertedRangeNotice />
      </div>
    );
  }

  const { users, exports } = await getExportHistoryData({
    dateFrom,
    dateTo,
    reportModule,
    format,
    status,
    userId,
    searchText,
  });

  const totalExports = exports.length;

  const excelExports = exports.filter((exportItem) => {
    return exportItem.formato === "excel";
  }).length;

  const pdfExports = exports.filter((exportItem) => {
    return exportItem.formato === "pdf";
  }).length;

  const generatedExports = exports.filter((exportItem) => {
    return exportItem.estado === "generada";
  }).length;

  const uniqueUsers = new Set(
    exports.map((exportItem) => exportItem.id_usuario),
  ).size;

  const uniqueModules = new Set(
    exports.map((exportItem) => exportItem.modulo_origen),
  ).size;

  return (
    <div className="space-y-6">
      <PageHeader
        {...pageHeader}
      />

      <ReportFilters filters={filters} users={users} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="Exportaciones" value={totalExports.toString()} description="Registros encontrados según filtros." tone="info" icon={ClipboardList} />
        <KpiCard title="Excel" value={excelExports.toString()} description="Exportaciones registradas como Excel." tone="info" icon={FileSpreadsheet} />
        <KpiCard title="PDF" value={pdfExports.toString()} description="Exportaciones PDF registradas." tone="info" icon={FileText} />
        <KpiCard title="Generadas" value={generatedExports.toString()} description="Exportaciones completadas correctamente." tone="success" icon={ClipboardList} />
        <KpiCard title="Usuarios" value={uniqueUsers.toString()} description="Usuarios que exportaron reportes." tone="info" icon={Users} />
        <KpiCard title="Módulos" value={uniqueModules.toString()} description="Tipos de reporte exportados." tone="info" icon={LayoutGrid} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Resultado del historial
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {exports.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No se encontraron exportaciones con los filtros aplicados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Reporte</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Filtros usados</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {exports.map((exportItem) => (
                  <TableRow key={exportItem.id_exportacion} className="align-top">
                    <TableCell className="font-medium">
                      {exportItem.id_exportacion}
                    </TableCell>

                    <TableCell>
                      {formatDateTime(exportItem.fecha_exportacion)}
                    </TableCell>

                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {exportItem.usuario.apellidos},{" "}
                          {exportItem.usuario.nombres}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {exportItem.usuario.correo}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>{exportItem.modulo_origen}</TableCell>

                    <TableCell>{getFormatLabel(exportItem.formato)}</TableCell>

                    <TableCell>{getStatusLabel(exportItem.estado)}</TableCell>

                    <TableCell className="min-w-56">
                      {exportItem.ruta_archivo ?? "-"}
                    </TableCell>

                    <TableCell className="min-w-80 text-xs text-muted-foreground">
                      {formatParams(exportItem.parametros)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <p className="mt-3 px-6 text-xs text-muted-foreground">
            Se muestran como máximo 150 exportaciones para mantener una consulta
            rápida.
          </p>
        </CardContent>
      </Card>

      <section className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          Este historial sirve como trazabilidad administrativa: permite auditar
          qué usuario exportó información, desde qué módulo, con qué filtros y
          en qué fecha.
        </p>
      </section>
    </div>
  );
}

