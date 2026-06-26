import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { APP_ROLES } from "@/lib/permissions";
import { createOperatorAction } from "@/modules/staff/operators/actions";

export default async function NewOperatorPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const today = new Date().toISOString().split("T")[0];

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Personal, asistencia y pagos · Nuevo operario
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Registrar operario
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Registra los datos laborales básicos del trabajador, su modalidad de
            pago, tarifa y estado dentro del taller.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Fase 8.2</Badge>
          <Badge>Solo ADMIN</Badge>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Datos laborales del operario
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form action={createOperatorAction} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="nombres" className="text-sm font-medium">
                    Nombres
                  </label>

                  <input
                    id="nombres"
                    name="nombres"
                    type="text"
                    required
                    placeholder="Ejemplo: Juan Carlos"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="apellidos" className="text-sm font-medium">
                    Apellidos
                  </label>

                  <input
                    id="apellidos"
                    name="apellidos"
                    type="text"
                    required
                    placeholder="Ejemplo: Quispe Ramos"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="cargo" className="text-sm font-medium">
                    Cargo
                  </label>

                  <input
                    id="cargo"
                    name="cargo"
                    type="text"
                    placeholder="Ejemplo: Operario de producción"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="especialidad" className="text-sm font-medium">
                    Especialidad
                  </label>

                  <input
                    id="especialidad"
                    name="especialidad"
                    type="text"
                    placeholder="Ejemplo: Corte, soldadura, pintura"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="telefono" className="text-sm font-medium">
                    Teléfono
                  </label>

                  <input
                    id="telefono"
                    name="telefono"
                    type="text"
                    placeholder="Ejemplo: 987654321"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="fecha_ingreso" className="text-sm font-medium">
                    Fecha de ingreso
                  </label>

                  <input
                    id="fecha_ingreso"
                    name="fecha_ingreso"
                    type="date"
                    defaultValue={today}
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="direccion" className="text-sm font-medium">
                  Dirección
                </label>

                <input
                  id="direccion"
                  name="direccion"
                  type="text"
                  placeholder="Ejemplo: Andahuaylas, Apurímac"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label
                    htmlFor="modalidad_pago"
                    className="text-sm font-medium"
                  >
                    Modalidad de pago
                  </label>

                  <select
                    id="modalidad_pago"
                    name="modalidad_pago"
                    required
                    defaultValue="semanal"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="tarifa" className="text-sm font-medium">
                    Tarifa
                  </label>

                  <input
                    id="tarifa"
                    name="tarifa"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ejemplo: 80.00"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="estado" className="text-sm font-medium">
                    Estado
                  </label>

                  <select
                    id="estado"
                    name="estado"
                    required
                    defaultValue="activo"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
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
                  placeholder="Observaciones laborales del operario."
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Registrar operario
                </button>

                <Link
                  href="/dashboard/staff/operators"
                  className="rounded-md border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
                >
                  Ver listado
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recomendación</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Registra primero a los operarios activos del taller para poder
              asociarlos luego con asistencia diaria, tareas y planillas.
            </p>

            <p>
              La modalidad de pago será usada más adelante para calcular
              periodos semanales, quincenales o mensuales.
            </p>

            <p>
              La tarifa puede representar pago diario, semanal o mensual según
              la política interna que validaremos en la subfase de planillas.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}