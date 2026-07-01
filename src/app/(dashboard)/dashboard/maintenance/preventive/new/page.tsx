import Link from "next/link";

import { SearchableSelect } from "@/components/forms/searchable-select";
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
import { createPreventiveMaintenanceAction } from "@/modules/maintenance/preventive/actions";

function getTodayValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  return now.toISOString().slice(0, 10);
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

export default async function NewPreventiveMaintenancePage() {
  await requireRole([APP_ROLES.ADMIN]);

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

  const today = getTodayValue();
  const machineItems = machines.map((machine) => ({
    id: machine.id_maquina,
    label: machine.nombre,
    description: `${machine.tipo} - ${getMachineStatusLabel(machine.estado)}`,
  }));

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard - Mantenimiento de maquinaria - Nuevo preventivo
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Programar mantenimiento preventivo
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Programa actividades preventivas por maquina para anticipar fallas,
            reducir paradas imprevistas y mantener la continuidad del taller.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Fase 9.6</Badge>
          <Badge>Solo ADMIN</Badge>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Datos del mantenimiento preventivo
            </CardTitle>
          </CardHeader>

          <CardContent>
            {machines.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm font-medium">
                  No hay maquinas registradas.
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Primero registra una maquina para poder programar
                  mantenimientos preventivos.
                </p>

                <Link
                  href="/dashboard/maintenance/machines/new"
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Registrar maquina
                </Link>
              </div>
            ) : (
              <form
                action={createPreventiveMaintenanceAction}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <SearchableSelect
                    name="id_maquina"
                    label="Maquina"
                    placeholder="Buscar maquina..."
                    items={machineItems}
                    required
                    emptyMessage="No hay maquinas registradas."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label
                      htmlFor="fecha_programada"
                      className="text-sm font-medium"
                    >
                      Fecha programada
                    </label>

                    <input
                      id="fecha_programada"
                      name="fecha_programada"
                      type="date"
                      required
                      defaultValue={today}
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="estado" className="text-sm font-medium">
                      Estado inicial
                    </label>

                    <select
                      id="estado"
                      name="estado"
                      required
                      defaultValue="pendiente"
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="realizado">Realizado</option>
                      <option value="vencido">Vencido</option>
                      <option value="anulado">Anulado</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="responsable" className="text-sm font-medium">
                      Responsable
                    </label>

                    <input
                      id="responsable"
                      name="responsable"
                      type="text"
                      placeholder="Ejemplo: Maestro de taller"
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="actividad" className="text-sm font-medium">
                    Actividad preventiva
                  </label>

                  <input
                    id="actividad"
                    name="actividad"
                    type="text"
                    required
                    placeholder="Ejemplo: Lubricacion general y revision de presion hidraulica"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="observaciones" className="text-sm font-medium">
                    Observaciones
                  </label>

                  <textarea
                    id="observaciones"
                    name="observaciones"
                    rows={4}
                    placeholder="Ejemplo: Revisar mangueras, pernos, fugas y nivel de aceite."
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="submit"
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Programar preventivo
                  </button>

                  <Link
                    href="/dashboard/maintenance/preventive"
                    className="rounded-md border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
                  >
                    Ver listado
                  </Link>

                  <Link
                    href="/dashboard/maintenance"
                    className="rounded-md border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
                  >
                    Volver al modulo
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recomendacion</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Programa mantenimientos preventivos para maquinas criticas como
              prensas, cortadoras, soldadoras, compresoras o dobladoras.
            </p>

            <p>
              Manten el estado como <strong>Pendiente</strong> hasta que se
              realice la actividad. Al marcarlo como{" "}
              <strong>Realizado</strong>, el sistema registrara la fecha real de
              ejecucion.
            </p>

            <p>
              Los preventivos ayudan a reducir fallas inesperadas y costos por
              paradas de produccion.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
