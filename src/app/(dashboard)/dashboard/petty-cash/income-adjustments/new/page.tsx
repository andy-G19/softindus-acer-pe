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
import { prisma } from "@/lib/db";
import { createPettyCashIncomeAdjustmentAction } from "@/modules/petty-cash/income-adjustments/actions";

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

function getMovementLabel(type: string, concept: string) {
  if (type === "ingreso") {
    return "Ingreso";
  }

  if (concept.startsWith("Ajuste positivo")) {
    return "Ajuste positivo";
  }

  if (concept.startsWith("Ajuste negativo")) {
    return "Ajuste negativo";
  }

  return "Ajuste";
}

function getMovementBadgeVariant(type: string, concept: string) {
  if (type === "ingreso" || concept.startsWith("Ajuste positivo")) {
    return "default";
  }

  return "secondary";
}

export default async function NewPettyCashIncomeAdjustmentPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const today = new Date().toISOString().split("T")[0];

  const [openBoxes, latestMovements] = await Promise.all([
    prisma.caja_chica.findMany({
      where: {
        estado: "abierta",
      },
      orderBy: {
        nombre_caja: "asc",
      },
    }),

    prisma.movimiento_caja.findMany({
      where: {
        tipo_movimiento: {
          in: ["ingreso", "ajuste"],
        },
      },
      orderBy: {
        fecha_movimiento: "desc",
      },
      take: 6,
      include: {
        caja_chica: true,
      },
    }),
  ]);

  const totalOpenBalance = openBoxes.reduce((total, box) => {
    return total + toNumber(box.saldo_actual);
  }, 0);

  const totalLatestIncome = latestMovements
    .filter((movement) => movement.tipo_movimiento === "ingreso")
    .reduce((total, movement) => {
      return total + toNumber(movement.monto);
    }, 0);

  const latestAdjustments = latestMovements.filter((movement) => {
    return movement.tipo_movimiento === "ajuste";
  });

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Caja chica y finanzas · Ingresos y ajustes
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Registrar ingresos menores y ajustes
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Registra ingresos menores del taller o ajustes de caja chica para
            corregir diferencias de saldo, manteniendo trazabilidad de fecha,
            responsable, concepto, monto y observaciones.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/petty-cash"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al módulo
          </Link>

          <Badge variant="secondary">Fase 7.5</Badge>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cajas abiertas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{openBoxes.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Disponibles para ingresos y ajustes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saldo disponible</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(totalOpenBalance)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Suma de cajas abiertas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ajustes recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{latestAdjustments.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajustes dentro de los últimos movimientos consultados.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Datos del ingreso o ajuste
            </CardTitle>
          </CardHeader>

          <CardContent>
            {openBoxes.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm font-medium">
                  No hay cajas abiertas.
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Debes abrir una caja chica antes de registrar ingresos o
                  ajustes.
                </p>

                <Link
                  href="/dashboard/petty-cash/boxes/new"
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Abrir caja chica
                </Link>
              </div>
            ) : (
              <form
                action={createPettyCashIncomeAdjustmentAction}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label htmlFor="id_caja_chica" className="text-sm font-medium">
                    Caja chica
                  </label>

                  <select
                    id="id_caja_chica"
                    name="id_caja_chica"
                    required
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="">Selecciona una caja</option>

                    {openBoxes.map((box) => (
                      <option
                        key={box.id_caja_chica}
                        value={box.id_caja_chica}
                      >
                        {box.nombre_caja} · Saldo:{" "}
                        {formatMoney(box.saldo_actual)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="tipo_operacion" className="text-sm font-medium">
                    Tipo de operación
                  </label>

                  <select
                    id="tipo_operacion"
                    name="tipo_operacion"
                    required
                    defaultValue="ingreso"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="ingreso">
                      Ingreso menor — aumenta saldo
                    </option>
                    <option value="ajuste_incremento">
                      Ajuste positivo — aumenta saldo
                    </option>
                    <option value="ajuste_disminucion">
                      Ajuste negativo — disminuye saldo
                    </option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="concepto" className="text-sm font-medium">
                    Concepto
                  </label>

                  <input
                    id="concepto"
                    name="concepto"
                    type="text"
                    required
                    placeholder="Ejemplo: Devolución de vuelto no usado"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="monto" className="text-sm font-medium">
                    Monto
                  </label>

                  <input
                    id="monto"
                    name="monto"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="Ejemplo: 20.00"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="fecha_movimiento"
                    className="text-sm font-medium"
                  >
                    Fecha del movimiento
                  </label>

                  <input
                    id="fecha_movimiento"
                    name="fecha_movimiento"
                    type="date"
                    required
                    defaultValue={today}
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="comprobante" className="text-sm font-medium">
                    Comprobante o referencia
                  </label>

                  <input
                    id="comprobante"
                    name="comprobante"
                    type="text"
                    placeholder="Ejemplo: Ref. interna AJ-001"
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
                    placeholder="Detalle adicional del ingreso o ajuste."
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Registrar movimiento
                </button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Últimos ingresos y ajustes
            </CardTitle>
          </CardHeader>

          <CardContent>
            {latestMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay ingresos ni ajustes registrados.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Ingresos recientes consultados
                  </p>
                  <p className="text-lg font-bold">
                    {formatMoney(totalLatestIncome)}
                  </p>
                </div>

                {latestMovements.map((movement) => (
                  <div
                    key={movement.id_movimiento_caja}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {movement.concepto}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {movement.caja_chica.nombre_caja}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(movement.fecha_movimiento)}
                        </p>
                      </div>

                      <Badge
                        variant={getMovementBadgeVariant(
                          movement.tipo_movimiento,
                          movement.concepto,
                        )}
                      >
                        {getMovementLabel(
                          movement.tipo_movimiento,
                          movement.concepto,
                        )}
                      </Badge>
                    </div>

                    <p className="mt-2 text-sm font-medium">
                      {formatMoney(movement.monto)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}