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
import { createMachineAction } from "@/modules/maintenance/machines/actions";

export default async function NewMachinePage() {
  await requireRole([APP_ROLES.ADMIN]);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Mantenimiento de maquinaria · Nueva máquina
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Registrar máquina
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Registra una máquina o equipo crítico del taller para controlar su
            estado operativo, ubicación, fallas, reparaciones y mantenimientos
            preventivos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Fase 9.2</Badge>
          <Badge>Solo ADMIN</Badge>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Datos principales de la máquina
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form action={createMachineAction} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="nombre" className="text-sm font-medium">
                    Nombre de la máquina
                  </label>

                  <input
                    id="nombre"
                    name="nombre"
                    type="text"
                    required
                    placeholder="Ejemplo: Prensa hidráulica"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="tipo" className="text-sm font-medium">
                    Tipo de máquina
                  </label>

                  <select
                    id="tipo"
                    name="tipo"
                    required
                    defaultValue="prensa"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="prensa">Prensa</option>
                    <option value="cortadora">Cortadora</option>
                    <option value="soldadora">Soldadora</option>
                    <option value="esmeril">Esmeril</option>
                    <option value="taladro">Taladro</option>
                    <option value="compresora">Compresora</option>
                    <option value="dobladora">Dobladora</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="codigo_interno"
                    className="text-sm font-medium"
                  >
                    Código interno
                  </label>

                  <input
                    id="codigo_interno"
                    name="codigo_interno"
                    type="text"
                    placeholder="Ejemplo: MAQ-PRE-001"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="ubicacion" className="text-sm font-medium">
                    Ubicación
                  </label>

                  <input
                    id="ubicacion"
                    name="ubicacion"
                    type="text"
                    placeholder="Ejemplo: Área de corte"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="estado" className="text-sm font-medium">
                  Estado inicial
                </label>

                <select
                  id="estado"
                  name="estado"
                  required
                  defaultValue="operativa"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="operativa">Operativa</option>
                  <option value="en_reparacion">En mantenimiento</option>
                  <option value="dada_de_baja">Fuera de servicio</option>
                  <option value="inactiva">Inactiva</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="observaciones" className="text-sm font-medium">
                  Observaciones
                </label>

                <textarea
                  id="observaciones"
                  name="observaciones"
                  rows={4}
                  placeholder="Ejemplo: Máquina usada para prensado de piezas metálicas."
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Registrar máquina
                </button>

                <Link
                  href="/dashboard/maintenance/machines"
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recomendación</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Registra primero las máquinas críticas del taller, especialmente
              aquellas que pueden detener la producción si fallan.
            </p>

            <p>
              Ejemplos importantes: prensas, cortadoras, soldadoras, esmeriles,
              taladros, dobladoras o compresoras.
            </p>

            <p>
              El código interno ayuda a identificar equipos cuando existan varias
              máquinas del mismo tipo.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}