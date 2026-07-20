import {
  CalendarCheck,
  CircleDollarSign,
  Clock,
  FileSpreadsheet,
  UserRoundCheck,
  UserX,
} from "lucide-react";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
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
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { buildReportExportHref } from "@/lib/report-export-link";
import {
  buildDateRangeFilter,
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";

type PageProps = {
  searchParams?: Promise<SearchParamsRecord>;
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

export default async function StaffReportPage({ searchParams }: PageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const operario = parseStringParam(params, "operario");
  const modalidad = parseStringParam(params, "modalidad");
  const estado = parseStringParam(params, "estado");
  const from = parseStringParam(params, "from");
  const to = parseStringParam(params, "to");
  const dateRange = buildDateRangeFilter(
    parseDateParam(params, "from"),
    parseDateParam(params, "to"),
  );

  const payrollFilters: Prisma.planilla_pagoWhereInput[] = [];

  if (q) {
    payrollFilters.push({
      operario: {
        OR: [
          { nombres: { contains: q, mode: "insensitive" } },
          { apellidos: { contains: q, mode: "insensitive" } },
        ],
      },
    });
  }

  if (operario) {
    payrollFilters.push({ id_operario: operario });
  }

  if (modalidad) {
    payrollFilters.push({ modalidad_pago: modalidad });
  }

  if (estado) {
    payrollFilters.push({ estado_pago: estado });
  }

  if (dateRange) {
    payrollFilters.push({ periodo_inicio: dateRange });
  }

  const payrollWhere: Prisma.planilla_pagoWhereInput =
    payrollFilters.length > 0 ? { AND: payrollFilters } : {};

  const attendanceWhere: Prisma.asistenciaWhereInput = {
    ...(operario ? { id_operario: operario } : {}),
    ...(dateRange ? { fecha: dateRange } : {}),
  };

  const [operators, payrolls, attendanceCount, absenceCount, latenessCount] =
    await Promise.all([
      prisma.operario.findMany({
        where: {
          estado: "activo",
        },
        orderBy: [
          { apellidos: "asc" },
          { nombres: "asc" },
        ],
      }),
      prisma.planilla_pago.findMany({
        where: payrollWhere,
        orderBy: {
          fecha_generacion: "desc",
        },
        take: 100,
        include: {
          operario: true,
          historial_pago_operario: true,
        },
      }),
      prisma.asistencia.count({ where: attendanceWhere }),
      prisma.asistencia.count({ where: { ...attendanceWhere, falta: true } }),
      prisma.asistencia.count({ where: { ...attendanceWhere, tardanza: true } }),
    ]);

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

  return (
    <main className="space-y-6">
      <PageHeader
        title="Personal y planillas"
        description="Consulta asistencias, faltas, tardanzas, planillas generadas, pagos realizados y pendientes por operario."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Reportes", href: navigationHrefs.reports },
          { label: "Personal" },
        ])}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={buildReportExportHref("staff", exportParams)}>
                Exportar Excel
              </Link>
            </Button>
            <Button asChild>
              <Link href={buildReportExportHref("staff", exportParams, "pdf")}>
                Exportar PDF
              </Link>
            </Button>
          </>
        }
      />

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
                        {formatDate(payroll.periodo_inicio)} -{" "}
                        {formatDate(payroll.periodo_fin)}
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

