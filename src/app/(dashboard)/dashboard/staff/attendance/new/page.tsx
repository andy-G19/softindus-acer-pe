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
import { createAttendanceAction } from "@/modules/staff/attendance/actions";

export default async function NewAttendancePage() {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const today = new Date().toISOString().split("T")[0];

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
  });

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Personal, asistencia y pagos · Nueva asistencia
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Registrar asistencia diaria
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Registra la asistencia de un operario indicando fecha, hora de
            ingreso, hora de salida, tardanza, falta y observaciones.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Fase 8.3</Badge>
          <Badge>ADMIN / Maestro de taller</Badge>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Datos de asistencia
            </CardTitle>
          </CardHeader>

          <CardContent>
            {operators.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm font-medium">
                  No hay operarios activos disponibles.
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Primero registra o activa operarios para poder controlar su
                  asistencia.
                </p>

                <Link
                  href="/dashboard/staff/operators"
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Ir a operarios
                </Link>
              </div>
            ) : (
              <form action={createAttendanceAction} className="space-y-4">
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
                        {operator.cargo ?? "Sin cargo"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label htmlFor="fecha" className="text-sm font-medium">
                      Fecha
                    </label>

                    <input
                      id="fecha"
                      name="fecha"
                      type="date"
                      required
                      defaultValue={today}
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="hora_ingreso"
                      className="text-sm font-medium"
                    >
                      Hora de ingreso
                    </label>

                    <input
                      id="hora_ingreso"
                      name="hora_ingreso"
                      type="time"
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="hora_salida"
                      className="text-sm font-medium"
                    >
                      Hora de salida
                    </label>

                    <input
                      id="hora_salida"
                      name="hora_salida"
                      type="time"
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                    <input
                      name="tardanza"
                      type="checkbox"
                      className="mt-1"
                    />

                    <span>
                      <span className="block font-medium">
                        Marcar tardanza
                      </span>
                      <span className="text-muted-foreground">
                        Úsalo cuando el operario ingresó fuera del horario
                        esperado.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                    <input name="falta" type="checkbox" className="mt-1" />

                    <span>
                      <span className="block font-medium">
                        Marcar falta
                      </span>
                      <span className="text-muted-foreground">
                        Si marcas falta, deja vacías las horas de ingreso y
                        salida.
                      </span>
                    </span>
                  </label>
                </div>

                <div className="space-y-2">
                  <label htmlFor="observaciones" className="text-sm font-medium">
                    Observaciones
                  </label>

                  <textarea
                    id="observaciones"
                    name="observaciones"
                    rows={4}
                    placeholder="Ejemplo: Llegó tarde por transporte, permiso, salida anticipada, etc."
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="submit"
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Registrar asistencia
                  </button>

                  <Link
                    href="/dashboard/staff/attendance"
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
            <CardTitle className="text-base">Reglas de uso</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Cada operario solo puede tener un registro de asistencia por día.
            </p>

            <p>
              Si registras ingreso y salida, el sistema calculará las horas
              trabajadas automáticamente.
            </p>

            <p>
              Si marcas falta, no debes registrar horas de ingreso ni de salida.
            </p>

            <p>
              Este registro servirá más adelante para la generación de planillas.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}