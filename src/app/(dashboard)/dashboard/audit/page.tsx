import { Database, ScrollText, Users } from "lucide-react";
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
import { PaginationControls } from "@/components/pagination-controls";
import { requireRole } from "@/lib/authz";
import { formatDateTime } from "@/lib/formatters";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { getPaginationMeta, getPaginationParams } from "@/lib/pagination";
import { APP_ROLES } from "@/lib/permissions";
import { buildReportExportHref } from "@/lib/report-export-link";
import {
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";
import { exceedsReportExportRange, isReportDateRangeInverted } from "@/lib/reports/report-filters";
import { getAuditLogData, getAuditLogFilterOptions } from "@/modules/audit/queries";
import { ExportRangeNotice } from "@/modules/reports/export-range-notice";
import { InvertedRangeNotice } from "@/modules/reports/inverted-range-notice";

type PageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

type ReportFilterValues = Record<"q" | "usuario" | "accion" | "entidad" | "from" | "to", string>;
type ReportFilterOptions = Awaited<ReturnType<typeof getAuditLogFilterOptions>>;

// Filtros del reporte. Los pinta tambien la pantalla con el rango de fechas
// invertido, que no consulta los datos (entrega 10.2).
function ReportFilters({
  filters,
  users,
  actions,
  entities,
}: ReportFilterOptions & { filters: ReportFilterValues }) {
  const { q, usuario, accion, entidad, from, to } = filters;

  return (
    <Card>
      <CardContent className="pt-6">
        <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <div className="space-y-2">
            <Label htmlFor="q">Buscar</Label>
            <Input id="q" name="q" defaultValue={q} placeholder="Buscar detalle, entidad o accion" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="usuario">Usuario</Label>
            <NativeSelect id="usuario" name="usuario" defaultValue={usuario}>
              <option value="">Todos los usuarios</option>
              {users.map((user) => (
                <option key={user.id_usuario} value={user.id_usuario}>
                  {user.apellidos}, {user.nombres}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="accion">Acción</Label>
            <NativeSelect id="accion" name="accion" defaultValue={accion}>
              <option value="">Todas las acciones</option>
              {actions.map((item) => (
                <option key={item.accion} value={item.accion}>
                  {item.accion}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="entidad">Entidad</Label>
            <NativeSelect id="entidad" name="entidad" defaultValue={entidad}>
              <option value="">Todas las entidades</option>
              {entities.map((item) => (
                <option key={item.entidad_afectada} value={item.entidad_afectada}>
                  {item.entidad_afectada}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="from">Desde</Label>
            <Input id="from" name="from" type="date" defaultValue={from} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">Hasta</Label>
            <Input id="to" name="to" type="date" defaultValue={to} />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit">Filtrar</Button>
            <Button variant="clear" asChild>
              <Link href="/dashboard/audit">Limpiar</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default async function AuditPage({ searchParams }: PageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const usuario = parseStringParam(params, "usuario");
  const accion = parseStringParam(params, "accion");
  const entidad = parseStringParam(params, "entidad");
  const from = parseStringParam(params, "from");
  const to = parseStringParam(params, "to");
  const { page, pageSize, skip, take } = getPaginationParams(params);

  const filters = { q, usuario, accion, entidad, from, to };
  const pageHeader = {
    title: "Bitácora de operaciones",
    description: "Consulta solo lectura de acciones críticas, entidades afectadas, usuarios responsables, fecha, detalle e IP registrada.",
    breadcrumbs: dashboardBreadcrumbs([{ label: "Auditoría" }]),
  };

  // Con el rango invertido no se consultan los datos ni se ofrece exportar
  // (entrega 10.2): solo las opciones de los filtros y el aviso.
  if (isReportDateRangeInverted(from, to)) {
    const options = await getAuditLogFilterOptions();

    return (
      <main className="space-y-6">
        <PageHeader {...pageHeader} />
        <ReportFilters filters={filters} {...options} />
        <InvertedRangeNotice />
      </main>
    );
  }

  const {
    users,
    actions,
    entities,
    logs,
    totalLogs,
    distinctUsers,
    distinctEntities,
  } = await getAuditLogData(
    { q, usuario, accion, entidad, from, to },
    { skip, take },
  );

  const meta = getPaginationMeta({ totalItems: totalLogs, page, pageSize });

  const exportParams = {
    q,
    usuario,
    accion,
    entidad,
    from,
    to,
  };

  const exportRangeExceeded = exceedsReportExportRange(from, to);

  return (
    <main className="space-y-6">
      <PageHeader
        {...pageHeader}
        actions={
          exportRangeExceeded ? (
            <ExportRangeNotice />
          ) : (
            <>
              <Button variant="outline" asChild>
                <a href={buildReportExportHref("audit", exportParams)}>
                  Exportar Excel
                </a>
              </Button>
              <Button asChild>
                <a href={buildReportExportHref("audit", exportParams, "pdf")}>
                  Exportar PDF
                </a>
              </Button>
            </>
          )
        }
      />

      <ReportFilters filters={filters} users={users} actions={actions} entities={entities} />

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Operaciones" value={totalLogs.toString()} description="Coincidencias segun filtros." tone="info" icon={ScrollText} />
        <KpiCard title="Usuarios" value={distinctUsers.length.toString()} description="Usuarios distintos según filtros." tone="info" icon={Users} />
        <KpiCard title="Entidades" value={distinctEntities.length.toString()} description="Entidades afectadas según filtros." tone="info" icon={Database} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operaciones registradas</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {logs.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No se encontraron operaciones con los filtros aplicados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id_bitacora} className="align-top">
                    <TableCell>{formatDateTime(log.fecha_hora)}</TableCell>
                    <TableCell>
                      {log.usuario.apellidos}, {log.usuario.nombres}
                    </TableCell>
                    <TableCell>{log.accion}</TableCell>
                    <TableCell>{log.entidad_afectada}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.id_registro_afectado ?? "-"}
                    </TableCell>
                    <TableCell className="max-w-xl">
                      {log.detalle ?? "-"}
                    </TableCell>
                    <TableCell>{log.ip_origen ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PaginationControls
        meta={meta}
        basePath={navigationHrefs.audit}
        searchParams={params}
        itemLabel="operaciones"
      />
    </main>
  );
}


