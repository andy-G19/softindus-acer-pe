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
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Personal, asistencia y pagos · Registrar pago
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Registrar pago de planilla
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Selecciona una planilla pendiente y registra el pago realizado al
            operario. El sistema guardará el historial y marcará la planilla
            como pagada.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Fase 8.6</Badge>
          <Badge>Solo ADMIN</Badge>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Datos del pago</CardTitle>
          </CardHeader>

          <CardContent>
            {pendingPayrolls.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm font-medium">
                  No hay planillas pendientes de pago.
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Primero genera una planilla pendiente para poder registrar su
                  pago.
                </p>

                <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                  <Link
                    href="/dashboard/staff/payrolls"
                    className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
                  >
                    Ver planillas
                  </Link>

                  <Link
                    href="/dashboard/staff/payrolls/new"
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Generar planilla
                  </Link>
                </div>
              </div>
            ) : (
              <form
                action={registerOperatorPaymentAction}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label htmlFor="id_planilla" className="text-sm font-medium">
                    Planilla pendiente
                  </label>

                  <select
                    id="id_planilla"
                    name="id_planilla"
                    required
                    defaultValue=""
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
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
                  </select>

                  <p className="text-xs text-muted-foreground">
                    Para esta versión, el monto pagado debe ser igual al monto
                    neto de la planilla seleccionada.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label htmlFor="fecha_pago" className="text-sm font-medium">
                      Fecha de pago
                    </label>

                    <input
                      id="fecha_pago"
                      name="fecha_pago"
                      type="date"
                      required
                      defaultValue={today}
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="monto_pagado"
                      className="text-sm font-medium"
                    >
                      Monto pagado
                    </label>

                    <input
                      id="monto_pagado"
                      name="monto_pagado"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      placeholder="Ejemplo: 160.00"
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="metodo_pago"
                      className="text-sm font-medium"
                    >
                      Método de pago
                    </label>

                    <select
                      id="metodo_pago"
                      name="metodo_pago"
                      required
                      defaultValue="efectivo"
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="yape">Yape</option>
                      <option value="plin">Plin</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="observaciones" className="text-sm font-medium">
                    Observaciones
                  </label>

                  <textarea
                    id="observaciones"
                    name="observaciones"
                    rows={4}
                    placeholder="Ejemplo: Pago entregado en efectivo al finalizar la semana."
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="submit"
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Registrar pago
                  </button>

                  <Link
                    href="/dashboard/staff/payment-history"
                    className="rounded-md border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
                  >
                    Ver historial
                  </Link>
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

        <CardContent>
          {pendingPayrolls.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay planillas pendientes para mostrar.
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
                    <th className="py-2 pr-3 text-right">Bruto</th>
                    <th className="py-2 pr-3 text-right">Descuento</th>
                    <th className="py-2 text-right">Neto</th>
                  </tr>
                </thead>

                <tbody>
                  {pendingPayrolls.map((payroll) => (
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

                      <td className="py-2 text-right font-medium">
                        {formatMoney(payroll.monto_neto)}
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