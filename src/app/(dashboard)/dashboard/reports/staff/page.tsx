import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
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

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string | number;
  description: string;
}) {
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
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-muted-foreground">Reportes</p>
          <h1 className="text-3xl font-bold tracking-tight">
            Personal y planillas
          </h1>
          <p className="mt-2 max-w-4xl text-muted-foreground">
            Consulta asistencias, faltas, tardanzas, planillas generadas, pagos
            realizados y pendientes por operario.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/reports" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
            Volver
          </Link>
          <Link href={buildReportExportHref("staff", exportParams)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
            Exportar Excel
          </Link>
          <Link href={buildReportExportHref("staff", exportParams, "pdf")} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Exportar PDF
          </Link>
        </div>
      </section>

      <Card>
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
            <input name="q" defaultValue={q} placeholder="Buscar operario" className="rounded-md border px-3 py-2 text-sm" />
            <select name="operario" defaultValue={operario} className="rounded-md border px-3 py-2 text-sm">
              <option value="">Todos los operarios</option>
              {operators.map((operator) => (
                <option key={operator.id_operario} value={operator.id_operario}>
                  {operator.apellidos}, {operator.nombres}
                </option>
              ))}
            </select>
            <select name="modalidad" defaultValue={modalidad} className="rounded-md border px-3 py-2 text-sm">
              <option value="">Todas las modalidades</option>
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
            <select name="estado" defaultValue={estado} className="rounded-md border px-3 py-2 text-sm">
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="pagado">Pagado</option>
              <option value="anulada">Anulada</option>
            </select>
            <input name="from" type="date" defaultValue={from} className="rounded-md border px-3 py-2 text-sm" />
            <input name="to" type="date" defaultValue={to} className="rounded-md border px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Filtrar
              </button>
              <Link href="/dashboard/reports/staff" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
                Limpiar
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard title="Operarios activos" value={operators.length} description="Operarios habilitados." />
        <SummaryCard title="Asistencias" value={attendanceCount} description="Registros en el periodo." />
        <SummaryCard title="Faltas" value={absenceCount} description="Ausencias registradas." />
        <SummaryCard title="Tardanzas" value={latenessCount} description="Marcaciones tardias." />
        <SummaryCard title="Planillas" value={payrolls.length} description={`Pendientes: ${totals.pending}`} />
        <SummaryCard title="Pagado" value={formatMoney(totals.paid)} description={`Neto: ${formatMoney(totals.net)}`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planillas listadas</CardTitle>
        </CardHeader>
        <CardContent>
          {payrolls.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron planillas con los filtros aplicados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Planilla</th>
                    <th className="py-2 pr-3">Operario</th>
                    <th className="py-2 pr-3">Periodo</th>
                    <th className="py-2 pr-3">Modalidad</th>
                    <th className="py-2 pr-3 text-right">Neto</th>
                    <th className="py-2 pr-3 text-right">Pagado</th>
                    <th className="py-2 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {payrolls.map((payroll) => {
                    const paid = payroll.historial_pago_operario.reduce(
                      (sum, payment) => sum + toNumber(payment.monto_pagado),
                      0,
                    );

                    return (
                      <tr key={payroll.id_planilla} className="border-b">
                        <td className="py-2 pr-3 font-mono text-xs">{payroll.id_planilla}</td>
                        <td className="py-2 pr-3">{payroll.operario.apellidos}, {payroll.operario.nombres}</td>
                        <td className="py-2 pr-3">{formatDate(payroll.periodo_inicio)} - {formatDate(payroll.periodo_fin)}</td>
                        <td className="py-2 pr-3">{payroll.modalidad_pago}</td>
                        <td className="py-2 pr-3 text-right">{formatMoney(payroll.monto_neto)}</td>
                        <td className="py-2 pr-3 text-right">{formatMoney(paid)}</td>
                        <td className="py-2 text-right">{payroll.estado_pago}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
