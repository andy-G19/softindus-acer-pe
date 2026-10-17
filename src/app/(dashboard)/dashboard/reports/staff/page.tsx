import {
  CalendarCheck,
  CircleDollarSign,
  Clock,
  FileSpreadsheet,
  UserRoundCheck,
  UserX,
} from "lucide-react";
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
import { formatDate, formatMoney } from "@/lib/formatters";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { toNumber } from "@/lib/numbers";
import { APP_ROLES } from "@/lib/permissions";
import { buildReportExportHref } from "@/lib/report-export-link";
import { exceedsReportExportRange, isReportDateRangeInverted } from "@/lib/reports/report-filters";
import { getStaffReportData, getStaffReportFilterOptions } from "@/modules/reports/staff/queries";
import { ExportRangeNotice } from "@/modules/reports/export-range-notice";
import { InvertedRangeNotice } from "@/modules/reports/inverted-range-notice";
import {
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";

type PageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

type ReportFilterValues = Record<"q" | "operario" | "modalidad" | "estado" | "from" | "to", string>;
type ReportFilterOptions = Awaited<ReturnType<typeof getStaffReportFilterOptions>>;

// Filtros del reporte. Los pinta tambien la pantalla con el rango de fechas
// invertido, que no consulta los datos (entrega 10.2).
function ReportFilters({
  filters,
  operators,
}: ReportFilterOptions & { filters: ReportFilterValues }) {
  const { q, operario, modalidad, estado, from, to } = filters;

  return (
    <Card>
      <CardContent className="pt-6">
        <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <div className="space-y-2">
            <Label htmlFor="q">Buscar</Label>
            <Input id="q" name="q" defaultValue={q} placeholder="Buscar operario" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operario">Operario</Label>
            <NativeSelect id="operario" name="operario" defaultValue={operario}>
              <option value="">Todos los operarios</option>
              {operators.map((operator) => (
                <option key={operator.id_operario} value={operator.id_operario}>
                  {operator.apellidos}, {operator.nombres}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="modalidad">Modalidad</Label>
            <NativeSelect id="modalidad" name="modalidad" defaultValue={modalidad}>
              <option value="">Todas las modalidades</option>
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="estado">Estado</Label>
            <NativeSelect id="estado" name="estado" defaultValue={estado}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="pagado">Pagado</option>
              <option value="anulada">Anulada</option>
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
              <Link href="/dashboard/reports/staff">Limpiar</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default async function StaffReportPage({ searchParams }: PageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const operario = parseStringParam(params, "operario");
  const modalidad = parseStringParam(params, "modalidad");
  const estado = parseStringParam(params, "estado");
  const from = parseStringParam(params, "from");
  const to = parseStringParam(params, "to");
  const filters = { q, operario, modalidad, estado, from, to };
  const pageHeader = {
    title: "Personal y planillas",
    description: "Consulta asistencias, faltas, tardanzas, planillas generadas, pagos realizados y pendientes por operario.",
    breadcrumbs: dashboardBreadcrumbs([
      { label: "Reportes", href: navigationHrefs.reports },
      { label: "Personal" },
    ]),
  };

  // Con el rango invertido no se consultan los datos ni se ofrece exportar
  // (entrega 10.2): solo las opciones de los filtros y el aviso.
  if (isReportDateRangeInverted(from, to)) {
    const options = await getStaffReportFilterOptions();

    return (
      <main className="space-y-6">
        <PageHeader {...pageHeader} />
        <ReportFilters filters={filters} {...options} />
        <InvertedRangeNotice />
      </main>
    );
  }

  const { operators, payrolls, attendanceCount, absenceCount, latenessCount } =
    await getStaffReportData({
      q,
      operario,
      modalidad,
      estado,
      from,
      to,
    });

  const totals = payrolls.reduce(
    (acc, payroll) => {
      const paid = payroll.historial_pago_operario.reduce((sum, payment) => {
        return sum + toNumber(payment.monto_pagado);
      }, 0);

      acc.net += toNumber(payroll.monto_neto);
      acc.paid += paid;

      if (payroll.estado_pago === "pendiente") {
        acc.pending += 1;
      }

      return acc;
    },
    { net: 0, paid: 0, pending: 0 },
  );

  const exportParams = {
    q,
    operario,
    modalidad,
    estado,
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
                <a href={buildReportExportHref("staff", exportParams)}>
                  Exportar Excel
                </a>
              </Button>
              <Button asChild>
                <a href={buildReportExportHref("staff", exportParams, "pdf")}>
                  Exportar PDF
                </a>
              </Button>
            </>
          )
        }
      />

      <ReportFilters filters={filters} operators={operators} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="Operarios activos" value={operators.length.toString()} description="Operarios habilitados." tone="info" icon={UserRoundCheck} />
        <KpiCard title="Asistencias" value={attendanceCount.toString()} description="Registros en el periodo." tone="info" icon={CalendarCheck} />
        <KpiCard title="Faltas" value={absenceCount.toString()} description="Ausencias registradas." tone={absenceCount > 0 ? "warning" : "info"} icon={UserX} />
        <KpiCard title="Tardanzas" value={latenessCount.toString()} description="Marcaciones tardias." tone={latenessCount > 0 ? "warning" : "info"} icon={Clock} />
        <KpiCard title="Planillas" value={payrolls.length.toString()} description={`Pendientes: ${totals.pending}`} tone={totals.pending > 0 ? "warning" : "info"} icon={FileSpreadsheet} />
        <KpiCard title="Pagado" value={formatMoney(totals.paid)} description={`Neto: ${formatMoney(totals.net)}`} tone="success" icon={CircleDollarSign} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planillas listadas</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {payrolls.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No se encontraron planillas con los filtros aplicados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Planilla</TableHead>
                  <TableHead>Operario</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrolls.map((payroll) => {
                  const paid = payroll.historial_pago_operario.reduce(
                    (sum, payment) => sum + toNumber(payment.monto_pagado),
                    0,
                  );

                  return (
                    <TableRow key={payroll.id_planilla}>
                      <TableCell className="font-mono text-xs">
                        {payroll.id_planilla}
                      </TableCell>
                      <TableCell>
                        {payroll.operario.apellidos}, {payroll.operario.nombres}
                      </TableCell>
                      <TableCell>
                        {formatDate(payroll.periodo_inicio, { format: "dd/mm/yyyy" })} -{" "}
                        {formatDate(payroll.periodo_fin, { format: "dd/mm/yyyy" })}
                      </TableCell>
                      <TableCell>{payroll.modalidad_pago}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(payroll.monto_neto)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(paid)}
                      </TableCell>
                      <TableCell className="text-right">
                        {payroll.estado_pago}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

