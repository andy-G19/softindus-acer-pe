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
import { createRepairAction } from "@/modules/maintenance/repairs/actions";

function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function getTodayValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  return now.toISOString().slice(0, 10);
}

function getFailureStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    en_atencion: "En atencion",
    reparada: "Reparada",
    anulada: "Anulada",
  };

  return labels[status] ?? status;
}

export default async function NewRepairPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const failures = await prisma.falla_maquina.findMany({
    where: {
      estado_atencion: {
        in: ["pendiente", "en_atencion"],
      },
    },
    orderBy: {
      fecha_falla: "desc",
    },
    include: {
      maquina: true,
    },
  });

  const spareParts = await prisma.repuesto.findMany({
    where: {
      estado: true,
    },
    orderBy: {
      nombre_repuesto: "asc",
    },
  });

  const today = getTodayValue();
  const failureItems = failures.map((failure) => ({
    id: failure.id_falla,
    label: failure.maquina.nombre,
    description: `${formatDateTime(failure.fecha_falla)} - ${getFailureStatusLabel(
      failure.estado_atencion,
    )}`,
  }));
  const sparePartItems = spareParts.map((sparePart) => ({
    id: sparePart.id_repuesto,
    label: sparePart.nombre_repuesto,
    description: `S/ ${sparePart.costo_unitario.toString()}`,
  }));

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard - Mantenimiento de maquinaria - Nueva reparacion
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Registrar reparacion
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Registra la atencion realizada a una falla, incluyendo tecnico,
            mano de obra, repuestos utilizados y costo total calculado.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Fase 9.5</Badge>
          <Badge>Solo ADMIN</Badge>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Datos de la reparacion</CardTitle>
          </CardHeader>

          <CardContent>
            {failures.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm font-medium">
                  No hay fallas pendientes o en atencion.
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Primero registra una falla para poder asociarle una reparacion.
                </p>

                <Link
                  href="/dashboard/maintenance/failures/new"
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Registrar falla
                </Link>
              </div>
            ) : (
              <form action={createRepairAction} className="space-y-5">
                <div className="space-y-2">
                  <SearchableSelect
                    name="id_falla"
                    label="Falla a reparar"
                    placeholder="Buscar falla por maquina..."
                    items={failureItems}
                    required
                    emptyMessage="No hay fallas pendientes o en atencion."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label
                      htmlFor="fecha_reparacion"
                      className="text-sm font-medium"
                    >
                      Fecha de reparacion
                    </label>

                    <input
                      id="fecha_reparacion"
                      name="fecha_reparacion"
                      type="date"
                      required
                      defaultValue={today}
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="estado_reparacion"
                      className="text-sm font-medium"
                    >
                      Estado
                    </label>

                    <select
                      id="estado_reparacion"
                      name="estado_reparacion"
                      required
                      defaultValue="programada"
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <option value="programada">Programada</option>
                      <option value="ejecutada">Ejecutada</option>
                      <option value="observada">Observada</option>
                      <option value="anulada">Anulada</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="mano_obra" className="text-sm font-medium">
                      Mano de obra
                    </label>

                    <input
                      id="mano_obra"
                      name="mano_obra"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ejemplo: 80.00"
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="tecnico_proveedor"
                    className="text-sm font-medium"
                  >
                    Tecnico o proveedor
                  </label>

                  <input
                    id="tecnico_proveedor"
                    name="tecnico_proveedor"
                    type="text"
                    placeholder="Ejemplo: Tecnico interno / proveedor externo"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="rounded-lg border p-4">
                  <div>
                    <h2 className="text-base font-semibold">
                      Repuestos usados
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Puedes registrar hasta 3 repuestos en esta version. El
                      costo unitario se tomara automaticamente del catalogo de
                      repuestos.
                    </p>
                  </div>

                  <div className="mt-4 space-y-4">
                    {[1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className="grid gap-4 md:grid-cols-[1fr_160px]"
                      >
                        <div className="space-y-2">
                          <SearchableSelect
                            name={`id_repuesto_${index}`}
                            label={`Repuesto ${index}`}
                            placeholder="Buscar repuesto..."
                            items={sparePartItems}
                            emptyMessage="No hay repuestos activos."
                          />
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor={`cantidad_${index}`}
                            className="text-sm font-medium"
                          >
                            Cantidad
                          </label>

                          <input
                            id={`cantidad_${index}`}
                            name={`cantidad_${index}`}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Ejemplo: 1"
                            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                          />
                        </div>
                      </div>
                    ))}
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
                    placeholder="Ejemplo: Se cambio la manguera hidraulica y se realizo prueba de presion."
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="submit"
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Registrar reparacion
                  </button>

                  <Link
                    href="/dashboard/maintenance/repairs"
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
            <CardTitle className="text-base">Calculo automatico</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              El costo total se calcula automaticamente sumando la mano de obra
              mas los subtotales de los repuestos usados.
            </p>

            <p>
              Si registras una reparacion como <strong>Ejecutada</strong>, la
              falla pasara a <strong>Reparada</strong> y la maquina volvera a
              estado <strong>Operativa</strong>.
            </p>

            <p>
              Si la reparacion queda programada u observada, la falla pasara a
              <strong> En atencion</strong> y la maquina quedara en{" "}
              <strong>En mantenimiento</strong>.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
