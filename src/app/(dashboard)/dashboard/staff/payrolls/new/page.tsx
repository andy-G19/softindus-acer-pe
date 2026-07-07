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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { generatePayrollAction } from "@/modules/staff/payrolls/actions";

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

function getPaymentModeLabel(mode: string) {
  const labels: Record<string, string> = {
    semanal: "Semanal",
    quincenal: "Quincenal",
    mensual: "Mensual",
  };

  return labels[mode] ?? mode;
}

export default async function NewPayrollPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const today = new Date();
  const currentDate = today.toISOString().split("T")[0];

  const sevenDaysAgo = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 6,
  )
    .toISOString()
    .split("T")[0];

  const operators = await prisma.operario.findMany({
    where: {
      estado: "activo",
    },
    orderBy: [
      {
        apellidos: "asc",
      },
      {
        nombres: "asc",
      },
    ],
    include: {
      _count: {
        select: {
          asistencia: true,
          planilla_pago: true,
        },
      },
    },
  });

  const operatorItems = operators.map((operator) => ({
    id: operator.id_operario,
    label: `${operator.apellidos}, ${operator.nombres}`,
    description: `${getPaymentModeLabel(operator.modalidad_pago)} - Tarifa: ${formatMoney(operator.tarifa)}`,
  }));

  return (
    <main className="space-y-6">
      <PageHeader
        title="Generar planilla de pago"
        description="Selecciona un operario y un periodo. El sistema calculará el monto según asistencias válidas, tarifa configurada y descuentos."
        backHref={navigationHrefs.payrolls}
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
              <form action={generatePayrollAction} className="space-y-4">
                <div className="space-y-2">
                  <SearchableSelect
                    name="id_operario"
                    label="Operario"
                    placeholder="Buscar operario..."
                    items={operatorItems}
                    required
                    emptyMessage="No hay operarios activos disponibles."
                  />

                  <p className="text-xs text-muted-foreground">
                    La tarifa se multiplicará por las asistencias válidas del
                    periodo seleccionado.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="periodo_inicio">Inicio del periodo</Label>
                    <Input
                      id="periodo_inicio"
                      name="periodo_inicio"
                      type="date"
                      required
                      defaultValue={sevenDaysAgo}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="periodo_fin">Fin del periodo</Label>
                    <Input
                      id="periodo_fin"
                      name="periodo_fin"
                      type="date"
                      required
                      defaultValue={currentDate}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descuentos">Descuentos</Label>
                    <Input
                      id="descuentos"
                      name="descuentos"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue="0"
                      placeholder="Ejemplo: 10.00"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit">Generar planilla</Button>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/staff/payrolls">Ver listado</Link>
                  </Button>
                </div>
              </form>
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
                    {formatMoney(operator.tarifa)}
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
    </main>
  );
}
