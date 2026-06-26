import Link from "next/link";

//import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";

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

function getPaymentMethodLabel(method: string | null) {
  const labels: Record<string, string> = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    yape: "Yape",
    plin: "Plin",
    otro: "Otro",
  };

  if (!method) {
    return "-";
  }

  return labels[method] ?? method;
}

export default async function PaymentHistoryPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfNextMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    1,
  );

  const [
    totalPayments,
    paymentsThisMonth,
    totalPaidAmount,
    monthlyPaidAmount,
    latestPayments,
  ] = await Promise.all([
    prisma.historial_pago_operario.count(),

    prisma.historial_pago_operario.count({
      where: {
        fecha_pago: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    }),

    prisma.historial_pago_operario.aggregate({
      _sum: {
        monto_pagado: true,
      },
    }),

    prisma.historial_pago_operario.aggregate({
      where: {
        fecha_pago: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        monto_pagado: true,
      },
    }),

    prisma.historial_pago_operario.findMany({
      orderBy: [
        {
          fecha_pago: "desc",
        },
        {
          id_historial_pago: "desc",
        },
      ],
      take: 50,
      include: {
        planilla_pago: {
          include: {
            operario: true,
          },
        },
        usuario: true,
      },
    }),
  ]);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Personal, asistencia y pagos · Historial
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Historial de pagos por operario
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Consulta los pagos realizados a operarios a partir de planillas
            generadas, registrando fecha, método de pago, monto pagado,
            periodo y usuario responsable.
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
            href="/dashboard/staff/payment-history/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Registrar pago
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pagos registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalPayments}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total histórico de pagos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pagos del mes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{paymentsThisMonth}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Registros del periodo actual.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total pagado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(totalPaidAmount._sum.monto_pagado)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Acumulado histórico.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pagado este mes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(monthlyPaidAmount._sum.monto_pagado)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total mensual registrado.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Últimos pagos registrados
          </CardTitle>
        </CardHeader>

        <CardContent>
          {latestPayments.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm font-medium">
                Todavía no hay pagos registrados.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Registra el pago de una planilla pendiente para construir el
                historial del operario.
              </p>

              <Link
                href="/dashboard/staff/payment-history/new"
                className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Registrar primer pago
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Operario</th>
                    <th className="py-2 pr-3">Planilla</th>
                    <th className="py-2 pr-3">Periodo</th>
                    <th className="py-2 pr-3">Método</th>
                    <th className="py-2 pr-3 text-right">Monto</th>
                    <th className="py-2 pr-3">Registrado por</th>
                    <th className="py-2">Observaciones</th>
                  </tr>
                </thead>

                <tbody>
                  {latestPayments.map((payment) => (
                    <tr key={payment.id_historial_pago} className="border-b">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {payment.id_historial_pago}
                      </td>

                      <td className="py-2 pr-3">
                        {formatDate(payment.fecha_pago)}
                      </td>

                      <td className="py-2 pr-3 font-medium">
                        {payment.planilla_pago.operario.apellidos},{" "}
                        {payment.planilla_pago.operario.nombres}
                      </td>

                      <td className="py-2 pr-3 font-mono text-xs">
                        {payment.id_planilla}
                      </td>

                      <td className="py-2 pr-3">{payment.periodo}</td>

                      <td className="py-2 pr-3">
                        {getPaymentMethodLabel(payment.metodo_pago)}
                      </td>

                      <td className="py-2 pr-3 text-right font-medium">
                        {formatMoney(payment.monto_pagado)}
                      </td>

                      <td className="py-2 pr-3">
                        {payment.usuario.nombres} {payment.usuario.apellidos}
                      </td>

                      <td className="py-2">
                        {payment.observaciones ?? "-"}
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