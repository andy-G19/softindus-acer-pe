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
import { createPettyCashBoxAction } from "@/modules/petty-cash/boxes/actions";

export default async function NewPettyCashBoxPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const today = new Date().toISOString().split("T")[0];

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Caja chica y finanzas · Nueva caja
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Abrir caja chica
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Registra una nueva caja chica indicando nombre, saldo inicial,
            fecha de apertura, responsable y observaciones.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Fase 7.2</Badge>
          <Badge>Solo ADMIN</Badge>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Datos de apertura
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form action={createPettyCashBoxAction} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="nombre_caja" className="text-sm font-medium">
                  Nombre de la caja
                </label>

                <input
                  id="nombre_caja"
                  name="nombre_caja"
                  type="text"
                  required
                  placeholder="Ejemplo: Caja chica principal"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="saldo_inicial" className="text-sm font-medium">
                  Saldo inicial
                </label>

                <input
                  id="saldo_inicial"
                  name="saldo_inicial"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="Ejemplo: 200.00"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="fecha_apertura"
                  className="text-sm font-medium"
                >
                  Fecha de apertura
                </label>

                <input
                  id="fecha_apertura"
                  name="fecha_apertura"
                  type="date"
                  required
                  defaultValue={today}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="responsable" className="text-sm font-medium">
                  Responsable
                </label>

                <input
                  id="responsable"
                  name="responsable"
                  type="text"
                  placeholder="Ejemplo: Administrador"
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
                  placeholder="Observaciones sobre la apertura de caja."
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Abrir caja chica
                </button>

                <Link
                  href="/dashboard/petty-cash/boxes"
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
            <CardTitle className="text-base">
              Recomendación
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Usa una caja principal para los gastos menores diarios del taller.
            </p>

            <p>
              El saldo inicial será también el saldo actual al momento de crear
              la caja.
            </p>

            <p>
              Más adelante, los ingresos y egresos modificarán automáticamente
              el saldo actual.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}