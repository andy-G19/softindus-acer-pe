import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { staffNotifications } from "@/modules/staff/notifications";
import { registerOperatorPaymentAction } from "@/modules/staff/payment-history/actions";
import { OperatorPaymentForm } from "@/modules/staff/payment-history/operator-payment-form";
import { getPendingPayrolls } from "@/modules/staff/payment-history/queries";

type NewOperatorPaymentPageProps = {
  searchParams?: Promise<{ returnTo?: string | string[] }>;
};

function getPaymentModeLabel(mode: string) {
  const labels: Record<string, string> = {
    semanal: "Semanal",
    quincenal: "Quincenal",
    mensual: "Mensual",
  };

  return labels[mode] ?? mode;
}

export default async function NewOperatorPaymentPage({ searchParams }: NewOperatorPaymentPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = searchParams ? await searchParams : {};
  // C7 de la 11.5 (D59): al guardar o cancelar vuelve a la pagina de la que vino; sin ella, al
  // historial de pagos, como antes.
  const backHref = getSafeReturnTo(params.returnTo, navigationHrefs.paymentHistory);

  const today = new Date().toISOString().split("T")[0];

  const pendingPayrolls = await getPendingPayrolls();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrar pago de planilla"
        description="Selecciona una planilla pendiente y registra el pago realizado al operario. El sistema guardará el historial y marcará la planilla como pagada."
        backHref={backHref}
        backLabel="Volver al historial"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Personal", href: navigationHrefs.staff },
          { label: "Historial de pagos", href: navigationHrefs.paymentHistory },
          { label: "Registrar pago" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Datos del pago</CardTitle>
          </CardHeader>

          <CardContent>
            {pendingPayrolls.length === 0 ? (
              <EmptyState
                label="No hay planillas pendientes de pago."
                description="Primero genera una planilla pendiente para poder registrar su pago."
                action={
                  <div className="flex flex-col justify-center gap-2 sm:flex-row">
                    <Button variant="outline" asChild>
                      <Link href="/dashboard/staff/payrolls">
                        Ver planillas
                      </Link>
                    </Button>
                    <Button asChild>
                      <Link href="/dashboard/staff/payrolls/new">
                        Generar planilla
                      </Link>
                    </Button>
                  </div>
                }
              />
            ) : (
              <OperatorPaymentForm
                action={registerOperatorPaymentAction}
                payrolls={pendingPayrolls.map((payroll) => ({
                  value: payroll.id_planilla,
                  label: `${payroll.id_planilla} · ${payroll.operario.apellidos}, ${payroll.operario.nombres} · Neto: ${formatMoney(payroll.monto_neto)}`,
                }))}
                defaultDate={today}
                successNotification={staffNotifications["operator-payment-registered"]}
                returnTo={backHref}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reglas de pago</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Solo se pueden pagar planillas con estado pendiente.
            </p>

            <p>
              Al registrar el pago, la planilla cambia automáticamente a pagada.
            </p>

            <p>
              El historial conserva la fecha, monto, método, periodo y usuario
              responsable del registro.
            </p>

            <p>
              En esta versión no usaremos pagos parciales; el monto pagado debe
              coincidir con el monto neto.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Planillas pendientes disponibles
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {pendingPayrolls.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No hay planillas pendientes para mostrar."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Planilla</TableHead>
                  <TableHead>Operario</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Descuento</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {pendingPayrolls.map((payroll) => (
                  <TableRow key={payroll.id_planilla}>
                    <TableCell className="font-mono text-xs">
                      {payroll.id_planilla}
                    </TableCell>

                    <TableCell className="font-medium">
                      {payroll.operario.apellidos}, {payroll.operario.nombres}
                    </TableCell>

                    <TableCell>
                      {formatDate(payroll.periodo_inicio, { format: "dd/mm/yyyy" })} -{" "}
                      {formatDate(payroll.periodo_fin, { format: "dd/mm/yyyy" })}
                    </TableCell>

                    <TableCell>
                      {getPaymentModeLabel(payroll.modalidad_pago)}
                    </TableCell>

                    <TableCell className="text-right">
                      {formatMoney(payroll.monto_bruto)}
                    </TableCell>

                    <TableCell className="text-right">
                      {formatMoney(payroll.descuentos)}
                    </TableCell>

                    <TableCell className="text-right font-medium">
                      {formatMoney(payroll.monto_neto)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}