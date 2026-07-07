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
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { registerOperatorPaymentAction } from "@/modules/staff/payment-history/actions";

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

export default async function NewOperatorPaymentPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const today = new Date().toISOString().split("T")[0];

  const pendingPayrolls = await prisma.planilla_pago.findMany({
    where: {
      estado_pago: "pendiente",
    },
    orderBy: [
      {
        fecha_generacion: "desc",
      },
      {
        id_planilla: "desc",
      },
    ],
    include: {
      operario: true,
    },
  });

  return (
    <main className="space-y-6">
      <PageHeader
        title="Registrar pago de planilla"
        description="Selecciona una planilla pendiente y registra el pago realizado al operario. El sistema guardará el historial y marcará la planilla como pagada."
        backHref={navigationHrefs.paymentHistory}
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
              <form
                action={registerOperatorPaymentAction}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="id_planilla">Planilla pendiente</Label>
                  <NativeSelect
                    id="id_planilla"
                    name="id_planilla"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Seleccione una planilla
                    </option>

                    {pendingPayrolls.map((payroll) => (
                      <option
                        key={payroll.id_planilla}
                        value={payroll.id_planilla}
                      >
                        {payroll.id_planilla} ·{" "}
                        {payroll.operario.apellidos},{" "}
                        {payroll.operario.nombres} · Neto:{" "}
                        {formatMoney(payroll.monto_neto)}
                      </option>
                    ))}
                  </NativeSelect>

                  <p className="text-xs text-muted-foreground">
                    Para esta versión, el monto pagado debe ser igual al monto
                    neto de la planilla seleccionada.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="fecha_pago">Fecha de pago</Label>
                    <Input
                      id="fecha_pago"
                      name="fecha_pago"
                      type="date"
                      required
                      defaultValue={today}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monto_pagado">Monto pagado</Label>
                    <Input
                      id="monto_pagado"
                      name="monto_pagado"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      placeholder="Ejemplo: 160.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="metodo_pago">Método de pago</Label>
                    <NativeSelect
                      id="metodo_pago"
                      name="metodo_pago"
                      required
                      defaultValue="efectivo"
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="yape">Yape</option>
                      <option value="plin">Plin</option>
                      <option value="otro">Otro</option>
                    </NativeSelect>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <Textarea
                    id="observaciones"
                    name="observaciones"
                    rows={4}
                    placeholder="Ejemplo: Pago entregado en efectivo al finalizar la semana."
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit">Registrar pago</Button>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/staff/payment-history">
                      Ver historial
                    </Link>
                  </Button>
                </div>
              </form>
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
                      {formatDate(payroll.periodo_inicio)} -{" "}
                      {formatDate(payroll.periodo_fin)}
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
    </main>
  );
}