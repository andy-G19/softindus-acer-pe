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
import { formatMoney } from "@/lib/formatters";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { staffNotifications } from "@/modules/staff/notifications";
import { generatePayrollAction } from "@/modules/staff/payrolls/actions";
import { PayrollForm } from "@/modules/staff/payrolls/payroll-form";
import { getPayrollFormOperators } from "@/modules/staff/payrolls/queries";

type NewPayrollPageProps = {
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

export default async function NewPayrollPage({ searchParams }: NewPayrollPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = searchParams ? await searchParams : {};
  // C6 de la 11.5 (D59): al guardar o cancelar vuelve a la pagina de la que vino; sin ella, al
  // listado de planillas, como antes.
  const backHref = getSafeReturnTo(params.returnTo, navigationHrefs.payrolls);

  const today = new Date();
  const currentDate = today.toISOString().split("T")[0];

  const sevenDaysAgo = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 6,
  )
    .toISOString()
    .split("T")[0];

  const operators = await getPayrollFormOperators();

  const operatorItems = operators.map((operator) => ({
    id: operator.id_operario,
    label: `${operator.apellidos}, ${operator.nombres}`,
    description: `${getPaymentModeLabel(operator.modalidad_pago)} - Tarifa: ${formatMoney(operator.tarifa, { emptyText: "-" })}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Generar planilla de pago"
        description="Selecciona un operario y un periodo. El sistema calculará el monto según asistencias válidas, tarifa configurada y descuentos."
        backHref={backHref}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Personal", href: navigationHrefs.staff },
          { label: "Planillas", href: navigationHrefs.payrolls },
          { label: "Nueva planilla" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Datos para generación
            </CardTitle>
          </CardHeader>

          <CardContent>
            {operators.length === 0 ? (
              <EmptyState
                label="No hay operarios activos disponibles."
                description="Primero registra o activa operarios para generar planillas."
                action={
                  <Button asChild>
                    <Link href="/dashboard/staff/operators">Ir a operarios</Link>
                  </Button>
                }
              />
            ) : (
              <PayrollForm
                action={generatePayrollAction}
                operators={operatorItems}
                defaultStartDate={sevenDaysAgo}
                defaultEndDate={currentDate}
                successNotification={staffNotifications["payroll-created"]}
                returnTo={backHref}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reglas de cálculo</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              La planilla se genera por un operario y un rango de fechas.
            </p>

            <p>
              Solo se consideran asistencias donde el operario no tenga falta.
            </p>

            <p>
              El monto bruto se calcula multiplicando asistencias válidas por la
              tarifa registrada del operario.
            </p>

            <p>
              Los descuentos se restan del monto bruto para obtener el monto
              neto.
            </p>

            <p>
              La planilla se crea con estado pendiente. En la siguiente subfase
              registraremos el pago real.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Operarios disponibles para planilla
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operario</TableHead>
                <TableHead>Modalidad</TableHead>
                <TableHead className="text-right">Tarifa</TableHead>
                <TableHead className="text-right">Asistencias</TableHead>
                <TableHead className="text-right">Planillas</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {operators.map((operator) => (
                <TableRow key={operator.id_operario}>
                  <TableCell className="font-medium">
                    {operator.apellidos}, {operator.nombres}
                  </TableCell>

                  <TableCell>
                    {getPaymentModeLabel(operator.modalidad_pago)}
                  </TableCell>

                  <TableCell className="text-right">
                    {formatMoney(operator.tarifa, { emptyText: "-" })}
                  </TableCell>

                  <TableCell className="text-right">
                    {operator._count.asistencia}
                  </TableCell>

                  <TableCell className="text-right">
                    {operator._count.planilla_pago}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
