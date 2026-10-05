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
import { getOperatorPaymentHistoryData } from "@/modules/staff/payment-history/queries";
import { formatDate, formatMoney } from "@/lib/formatters";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";

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

  const {
    totalPayments,
    paymentsThisMonth,
    totalPaidAmount,
    monthlyPaidAmount,
    latestPayments,
  } = await getOperatorPaymentHistoryData(today);

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
        <KpiCard title="Total pagado" value={formatMoney(totalPaidAmount._sum.monto_pagado ?? 0)} description="Acumulado histórico." tone="success" icon={CircleDollarSign} />
        <KpiCard title="Pagado este mes" value={formatMoney(monthlyPaidAmount._sum.monto_pagado ?? 0)} description="Total mensual registrado." tone="success" icon={CircleDollarSign} />
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

                    <TableCell>{formatDate(payment.fecha_pago, { format: "dd/mm/yyyy" })}</TableCell>

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