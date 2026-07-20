import { CircleDollarSign, ClipboardList } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
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
      <PageHeader
        title="Historial de pagos por operario"
        description="Consulta los pagos realizados a operarios a partir de planillas generadas, registrando fecha, método de pago, monto pagado, periodo y usuario responsable."
        backHref={navigationHrefs.staff}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Personal", href: navigationHrefs.staff },
          { label: "Historial de pagos" },
        ])}
        actions={
          <Button asChild>
            <Link href="/dashboard/staff/payment-history/new">
              Registrar pago
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Pagos registrados" value={totalPayments.toString()} description="Total histórico de pagos." tone="info" icon={ClipboardList} />
        <KpiCard title="Pagos del mes" value={paymentsThisMonth.toString()} description="Registros del periodo actual." tone="info" icon={CircleDollarSign} />
        <KpiCard title="Total pagado" value={formatMoney(totalPaidAmount._sum.monto_pagado)} description="Acumulado histórico." tone="success" icon={CircleDollarSign} />
        <KpiCard title="Pagado este mes" value={formatMoney(monthlyPaidAmount._sum.monto_pagado)} description="Total mensual registrado." tone="success" icon={CircleDollarSign} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Últimos pagos registrados
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {latestPayments.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="Todavía no hay pagos registrados."
              description="Registra el pago de una planilla pendiente para construir el historial del operario."
              action={
                <Button asChild>
                  <Link href="/dashboard/staff/payment-history/new">
                    Registrar primer pago
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Operario</TableHead>
                  <TableHead>Planilla</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Registrado por</TableHead>
                  <TableHead>Observaciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {latestPayments.map((payment) => (
                  <TableRow key={payment.id_historial_pago}>
                    <TableCell className="font-mono text-xs">
                      {payment.id_historial_pago}
                    </TableCell>

                    <TableCell>{formatDate(payment.fecha_pago)}</TableCell>

                    <TableCell className="font-medium">
                      {payment.planilla_pago.operario.apellidos},{" "}
                      {payment.planilla_pago.operario.nombres}
                    </TableCell>

                    <TableCell className="font-mono text-xs">
                      {payment.id_planilla}
                    </TableCell>

                    <TableCell>{payment.periodo}</TableCell>

                    <TableCell>
                      {getPaymentMethodLabel(payment.metodo_pago)}
                    </TableCell>

                    <TableCell className="text-right font-medium">
                      {formatMoney(payment.monto_pagado)}
                    </TableCell>

                    <TableCell>
                      {payment.usuario.nombres} {payment.usuario.apellidos}
                    </TableCell>

                    <TableCell>{payment.observaciones ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}