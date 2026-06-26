import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";
import { cancelPayrollAction } from "@/modules/staff/payrolls/actions";

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

function getPaymentModeLabel(mode: string) {
  const labels: Record<string, string> = {
    semanal: "Semanal",
    quincenal: "Quincenal",
    mensual: "Mensual",
  };

  return labels[mode] ?? mode;
}

function getPayrollStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    pagado: "Pagado",
    anulada: "Anulada",
  };

  return labels[status] ?? status;
}

function getPayrollBadgeVariant(status: string) {
  if (status === "pagado") {
    return "default";
  }

  if (status === "anulada") {
    return "destructive";
  }

  return "secondary";
}

export default async function PayrollsPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const [
    totalPayrolls,
    pendingPayrolls,
    paidPayrolls,
    canceledPayrolls,
    pendingNetAmount,
    latestPayrolls,
  ] = await Promise.all([
    prisma.planilla_pago.count(),

    prisma.planilla_pago.count({
      where: {
        estado_pago: "pendiente",
      },
    }),

    prisma.planilla_pago.count({
      where: {
        estado_pago: "pagado",
      },
    }),

    prisma.planilla_pago.count({
      where: {
        estado_pago: "anulada",
      },
    }),

    prisma.planilla_pago.aggregate({
      where: {
        estado_pago: "pendiente",
      },
      _sum: {
        monto_neto: true,
      },
    }),

    prisma.planilla_pago.findMany({
      orderBy: [
        {
          fecha_generacion: "desc",
        },
        {
          id_planilla: "desc",
        },
      ],
      take: 50,
      include: {
        operario: true,
        usuario: true,
        _count: {
          select: {
            historial_pago_operario: true,
          },
        },
      },
    }),
  ]);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Personal, asistencia y pagos · Planillas
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Planillas de pago
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Genera y consulta planillas de pago según operario, periodo,
            modalidad, tarifa configurada, asistencias válidas y descuentos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/staff"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al módulo
          </Link>

          <Link
            href="/dashboard/staff/payrolls/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Generar planilla
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Planillas generadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalPayrolls}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total histórico registrado.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingPayrolls}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Por pagar: {formatMoney(pendingNetAmount._sum.monto_neto)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pagadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{paidPayrolls}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Se marcarán en la siguiente subfase.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anuladas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{canceledPayrolls}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Registros descartados.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Últimas planillas generadas
          </CardTitle>
        </CardHeader>

        <CardContent>
          {latestPayrolls.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm font-medium">
                Todavía no hay planillas generadas.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Genera la primera planilla usando asistencias válidas del
                periodo seleccionado.
              </p>

              <Link
                href="/dashboard/staff/payrolls/new"
                className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Generar primera planilla
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Operario</th>
                    <th className="py-2 pr-3">Periodo</th>
                    <th className="py-2 pr-3">Modalidad</th>
                    <th className="py-2 pr-3 text-right">Bruto</th>
                    <th className="py-2 pr-3 text-right">Descuentos</th>
                    <th className="py-2 pr-3 text-right">Neto</th>
                    <th className="py-2 pr-3 text-right">Estado</th>
                    <th className="py-2 pr-3">Generado por</th>
                    <th className="py-2 text-right">Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {latestPayrolls.map((payroll) => (
                    <tr key={payroll.id_planilla} className="border-b">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {payroll.id_planilla}
                      </td>

                      <td className="py-2 pr-3 font-medium">
                        {payroll.operario.apellidos},{" "}
                        {payroll.operario.nombres}
                      </td>

                      <td className="py-2 pr-3">
                        {formatDate(payroll.periodo_inicio)} -{" "}
                        {formatDate(payroll.periodo_fin)}
                      </td>

                      <td className="py-2 pr-3">
                        {getPaymentModeLabel(payroll.modalidad_pago)}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {formatMoney(payroll.monto_bruto)}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {formatMoney(payroll.descuentos)}
                      </td>

                      <td className="py-2 pr-3 text-right font-medium">
                        {formatMoney(payroll.monto_neto)}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        <Badge
                          variant={getPayrollBadgeVariant(
                            payroll.estado_pago,
                          )}
                        >
                          {getPayrollStatusLabel(payroll.estado_pago)}
                        </Badge>
                      </td>

                      <td className="py-2 pr-3">
                        {payroll.usuario.nombres} {payroll.usuario.apellidos}
                      </td>

                      <td className="py-2 text-right">
                        {payroll.estado_pago !== "pendiente" ||
                        payroll._count.historial_pago_operario > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            Sin acción
                          </span>
                        ) : (
                          <form action={cancelPayrollAction}>
                            <input
                              type="hidden"
                              name="id_planilla"
                              value={payroll.id_planilla}
                            />

                            <button
                              type="submit"
                              className="rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-muted"
                            >
                              Anular
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}