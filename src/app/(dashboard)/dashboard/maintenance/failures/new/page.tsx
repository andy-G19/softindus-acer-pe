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
import { createFailureAction } from "@/modules/maintenance/failures/actions";

function getCurrentDateTimeValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  return now.toISOString().slice(0, 16);
}

function getMachineStatusLabel(status: string) {
  const labels: Record<string, string> = {
    operativa: "Operativa",
    en_reparacion: "En mantenimiento",
    inactiva: "Inactiva",
    dada_de_baja: "Fuera de servicio",
  };

  return labels[status] ?? status;
}

export default async function NewFailurePage() {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const machines = await prisma.maquina.findMany({
    orderBy: [
      {
        estado: "asc",
      },
      {
        nombre: "asc",
      },
    ],
  });

  const currentDateTime = getCurrentDateTimeValue();

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Mantenimiento de maquinaria · Nueva falla
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Registrar falla de maquinaria
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Documenta una falla técnica de una máquina o equipo crítico,
            registrando fecha, descripción, responsable, tiempo perdido e
            impacto en producción.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Fase 9.3</Badge>
          <Badge>ADMIN / Maestro de taller</Badge>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Datos de la falla
            </CardTitle>
          </CardHeader>

          <CardContent>
            {machines.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm font-medium">
                  No hay máquinas registradas.
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Primero registra una máquina para poder documentar sus fallas.
                </p>

                <Link
                  href="/dashboard/maintenance/machines/new"
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Registrar máquina
                </Link>
              </div>
            ) : (
              <form action={createFailureAction} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="id_maquina" className="text-sm font-medium">
                    Máquina
                  </label>

                  <select
                    id="id_maquina"
                    name="id_maquina"
                    required
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="">Seleccione una máquina</option>
                    {machines.map((machine) => (
                      <option
                        key={machine.id_maquina}
                        value={machine.id_maquina}
                      >
                        {machine.nombre} · {machine.tipo} ·{" "}
                        {getMachineStatusLabel(machine.estado)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="fecha_falla" className="text-sm font-medium">
                      Fecha y hora de falla
                    </label>

                    <input
                      id="fecha_falla"
                      name="fecha_falla"
                      type="datetime-local"
                      required
                      defaultValue={currentDateTime}
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="estado_atencion"
                      className="text-sm font-medium"
                    >
                      Estado de atención
                    </label>

                    <select
                      id="estado_atencion"
                      name="estado_atencion"
                      required
                      defaultValue="pendiente"
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="en_atencion">En atención</option>
                      <option value="reparada">Reparada</option>
                      <option value="anulada">Anulada</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="descripcion" className="text-sm font-medium">
                    Descripción de la falla
                  </label>

                  <textarea
                    id="descripcion"
                    name="descripcion"
                    rows={4}
                    required
                    placeholder="Ejemplo: La prensa hidráulica perdió presión durante el proceso de doblado."
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="responsable_registro"
                      className="text-sm font-medium"
                    >
                      Responsable del registro
                    </label>

                    <input
                      id="responsable_registro"
                      name="responsable_registro"
                      type="text"
                      placeholder="Ejemplo: Maestro de taller"
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="tiempo_perdido_horas"
                      className="text-sm font-medium"
                    >
                      Tiempo perdido en horas
                    </label>

                    <input
                      id="tiempo_perdido_horas"
                      name="tiempo_perdido_horas"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ejemplo: 2.50"
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="impacto_produccion"
                    className="text-sm font-medium"
                  >
                    Impacto en producción
                  </label>

                  <textarea
                    id="impacto_produccion"
                    name="impacto_produccion"
                    rows={3}
                    placeholder="Ejemplo: Se detuvo el doblado de piezas durante la tarde."
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="submit"
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Registrar falla
                  </button>

                  <Link
                    href="/dashboard/maintenance/failures"
                    className="rounded-md border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
                  >
                    Ver listado
                  </Link>

                  <Link
                    href="/dashboard/maintenance"
                    className="rounded-md border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
                  >
                    Volver al módulo
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recomendación</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Registra la falla apenas ocurra para no perder trazabilidad del
              tiempo detenido y del impacto en producción.
            </p>

            <p>
              Si la falla todavía no fue revisada, usa el estado{" "}
              <strong>Pendiente</strong>. Si ya está siendo atendida, usa{" "}
              <strong>En atención</strong>.
            </p>

            <p>
              La reparación y el costo económico se registrarán en la siguiente
              subfase, cuando implementemos reparaciones y repuestos.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}