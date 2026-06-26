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

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Personal, asistencia y pagos · Nueva planilla
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Generar planilla de pago
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Selecciona un operario y un periodo. El sistema calculará el monto
            según asistencias válidas, tarifa configurada y descuentos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Fase 8.5</Badge>
          <Badge>Solo ADMIN</Badge>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Datos para generación
            </CardTitle>
          </CardHeader>

          <CardContent>
            {operators.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm font-medium">
                  No hay operarios activos disponibles.
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Primero registra o activa operarios para generar planillas.
                </p>

                <Link
                  href="/dashboard/staff/operators"
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Ir a operarios
                </Link>
              </div>
            ) : (
              <form action={generatePayrollAction} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="id_operario" className="text-sm font-medium">
                    Operario
                  </label>

                  <select
                    id="id_operario"
                    name="id_operario"
                    required
                    defaultValue=""
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="" disabled>
                      Seleccione un operario
                    </option>

                    {operators.map((operator) => (
                      <option
                        key={operator.id_operario}
                        value={operator.id_operario}
                      >
                        {operator.apellidos}, {operator.nombres} ·{" "}
                        {getPaymentModeLabel(operator.modalidad_pago)} · Tarifa:{" "}
                        {formatMoney(operator.tarifa)}
                      </option>
                    ))}
                  </select>

                  <p className="text-xs text-muted-foreground">
                    La tarifa se multiplicará por las asistencias válidas del
                    periodo seleccionado.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label
                      htmlFor="periodo_inicio"
                      className="text-sm font-medium"
                    >
                      Inicio del periodo
                    </label>

                    <input
                      id="periodo_inicio"
                      name="periodo_inicio"
                      type="date"
                      required
                      defaultValue={sevenDaysAgo}
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="periodo_fin"
                      className="text-sm font-medium"
                    >
                      Fin del periodo
                    </label>

                    <input
                      id="periodo_fin"
                      name="periodo_fin"
                      type="date"
                      required
                      defaultValue={currentDate}
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="descuentos" className="text-sm font-medium">
                      Descuentos
                    </label>

                    <input
                      id="descuentos"
                      name="descuentos"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue="0"
                      placeholder="Ejemplo: 10.00"
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="submit"
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Generar planilla
                  </button>

                  <Link
                    href="/dashboard/staff/payrolls"
                    className="rounded-md border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
                  >
                    Ver listado
                  </Link>
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

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-3">Operario</th>
                  <th className="py-2 pr-3">Modalidad</th>
                  <th className="py-2 pr-3 text-right">Tarifa</th>
                  <th className="py-2 pr-3 text-right">Asistencias</th>
                  <th className="py-2 text-right">Planillas</th>
                </tr>
              </thead>

              <tbody>
                {operators.map((operator) => (
                  <tr key={operator.id_operario} className="border-b">
                    <td className="py-2 pr-3 font-medium">
                      {operator.apellidos}, {operator.nombres}
                    </td>

                    <td className="py-2 pr-3">
                      {getPaymentModeLabel(operator.modalidad_pago)}
                    </td>

                    <td className="py-2 pr-3 text-right">
                      {formatMoney(operator.tarifa)}
                    </td>

                    <td className="py-2 pr-3 text-right">
                      {operator._count.asistencia}
                    </td>

                    <td className="py-2 text-right">
                      {operator._count.planilla_pago}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}