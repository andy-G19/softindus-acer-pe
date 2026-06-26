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
import { createPettyCashExpenseAction } from "@/modules/petty-cash/expenses/actions";

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatMoney(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
}

export default async function NewPettyCashExpensePage() {
  await requireRole([APP_ROLES.ADMIN]);

  const today = new Date().toISOString().split("T")[0];

  const [openBoxes, activeCategories, latestExpenses] = await Promise.all([
    prisma.caja_chica.findMany({
      where: {
        estado: "abierta",
      },
      orderBy: {
        nombre_caja: "asc",
      },
    }),

    prisma.categoria_gasto.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_categoria: "asc",
      },
    }),

    prisma.movimiento_caja.findMany({
      where: {
        tipo_movimiento: "egreso",
      },
      orderBy: {
        fecha_movimiento: "desc",
      },
      take: 5,
      include: {
        caja_chica: true,
        categoria_gasto: true,
      },
    }),
  ]);

  const totalOpenBalance = openBoxes.reduce((total, box) => {
    return total + toNumber(box.saldo_actual);
  }, 0);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Caja chica y finanzas · Egresos
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Registrar egreso de caja chica
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Registra gastos menores del taller, descuenta automáticamente el
            saldo de la caja seleccionada y conserva la trazabilidad del
            responsable, concepto, categoría, fecha y comprobante.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/petty-cash"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al módulo
          </Link>

          <Badge variant="secondary">Fase 7.4</Badge>
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
              Disponibles para registrar egresos.
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
              Suma de saldos actuales de cajas abiertas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categorías activas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeCategories.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Disponibles para clasificar gastos.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Datos del egreso
            </CardTitle>
          </CardHeader>

          <CardContent>
            {openBoxes.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm font-medium">
                  No hay cajas abiertas.
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Debes abrir una caja chica antes de registrar egresos.
                </p>

                <Link
                  href="/dashboard/petty-cash/boxes/new"
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Abrir caja chica
                </Link>
              </div>
            ) : activeCategories.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm font-medium">
                  No hay categorías activas.
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Debes registrar al menos una categoría activa antes de
                  registrar egresos.
                </p>

                <Link
                  href="/dashboard/petty-cash/categories"
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Crear categoría
                </Link>
              </div>
            ) : (
              <form action={createPettyCashExpenseAction} className="space-y-4">
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
                  <label
                    htmlFor="id_categoria_gasto"
                    className="text-sm font-medium"
                  >
                    Categoría de gasto
                  </label>

                  <select
                    id="id_categoria_gasto"
                    name="id_categoria_gasto"
                    required
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="">Selecciona una categoría</option>

                    {activeCategories.map((category) => (
                      <option
                        key={category.id_categoria_gasto}
                        value={category.id_categoria_gasto}
                      >
                        {category.nombre_categoria}
                      </option>
                    ))}
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
                    placeholder="Ejemplo: Compra de discos de corte"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="monto" className="text-sm font-medium">
                    Monto del egreso
                  </label>

                  <input
                    id="monto"
                    name="monto"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="Ejemplo: 35.50"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="fecha_movimiento"
                    className="text-sm font-medium"
                  >
                    Fecha del egreso
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
                    Comprobante
                  </label>

                  <input
                    id="comprobante"
                    name="comprobante"
                    type="text"
                    placeholder="Ejemplo: Boleta B001-45"
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
                    placeholder="Detalle adicional del gasto."
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Registrar egreso
                </button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Últimos egresos
            </CardTitle>
          </CardHeader>

          <CardContent>
            {latestExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay egresos registrados.
              </p>
            ) : (
              <div className="space-y-3">
                {latestExpenses.map((expense) => (
                  <div
                    key={expense.id_movimiento_caja}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {expense.concepto}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {expense.caja_chica.nombre_caja}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {expense.categoria_gasto?.nombre_categoria ?? "-"}
                        </p>
                      </div>

                      <Badge variant="destructive">
                        {formatMoney(expense.monto)}
                      </Badge>
                    </div>
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