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

function getMovementLabel(type: string) {
  const labels: Record<string, string> = {
    ingreso: "Ingreso",
    egreso: "Egreso",
    ajuste: "Ajuste",
  };

  return labels[type] ?? type;
}

function getMovementBadgeVariant(type: string) {
  if (type === "ingreso") {
    return "default";
  }

  if (type === "egreso") {
    return "destructive";
  }

  return "secondary";
}

export default async function PettyCashDashboardPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfNextMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    1,
  );

  const [
    openBoxes,
    totalBoxes,
    activeCategories,
    currentBalance,
    monthlyIncome,
    monthlyExpenses,
    monthlyMovements,
    latestBoxes,
    latestMovements,
  ] = await Promise.all([
    prisma.caja_chica.count({
      where: {
        estado: "abierta",
      },
    }),

    prisma.caja_chica.count(),

    prisma.categoria_gasto.count({
      where: {
        estado: true,
      },
    }),

    prisma.caja_chica.aggregate({
      where: {
        estado: "abierta",
      },
      _sum: {
        saldo_actual: true,
      },
    }),

    prisma.movimiento_caja.aggregate({
      where: {
        tipo_movimiento: "ingreso",
        fecha_movimiento: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        monto: true,
      },
    }),

    prisma.movimiento_caja.aggregate({
      where: {
        tipo_movimiento: "egreso",
        fecha_movimiento: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        monto: true,
      },
    }),

    prisma.movimiento_caja.count({
      where: {
        fecha_movimiento: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    }),

    prisma.caja_chica.findMany({
      orderBy: {
        fecha_apertura: "desc",
      },
      take: 5,
    }),

    prisma.movimiento_caja.findMany({
      orderBy: {
        fecha_movimiento: "desc",
      },
      take: 8,
      include: {
        caja_chica: true,
        categoria_gasto: true,
        usuario: true,
      },
    }),
  ]);

  const totalCurrentBalance = toNumber(currentBalance._sum.saldo_actual);
  const totalMonthlyIncome = toNumber(monthlyIncome._sum.monto);
  const totalMonthlyExpenses = toNumber(monthlyExpenses._sum.monto);
  const monthlyResult = totalMonthlyIncome - totalMonthlyExpenses;

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Caja chica y finanzas
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Módulo Caja Chica y Finanzas
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Controla cajas chicas, ingresos menores, egresos, categorías de
            gasto y movimientos financieros menores del taller.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Fase 7</Badge>
          <Badge>Solo ADMIN</Badge>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saldo actual abierto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(totalCurrentBalance)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Suma de saldos de cajas abiertas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingresos del mes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(totalMonthlyIncome)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Incluye ingresos menores y ventas de chatarra vinculadas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Egresos del mes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(totalMonthlyExpenses)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Gastos menores registrados en caja chica.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(monthlyResult)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ingresos menos egresos del mes actual.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cajas abiertas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{openBoxes}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total de cajas chicas actualmente abiertas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cajas registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalBoxes}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Historial total de cajas creadas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categorías activas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeCategories}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Categorías disponibles para clasificar egresos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movimientos del mes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{monthlyMovements}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total de ingresos, egresos y ajustes registrados este mes.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Últimos movimientos de caja
            </CardTitle>
          </CardHeader>

          <CardContent>
            {latestMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay movimientos de caja registrados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-3">Fecha</th>
                      <th className="py-2 pr-3">Tipo</th>
                      <th className="py-2 pr-3">Concepto</th>
                      <th className="py-2 pr-3">Caja</th>
                      <th className="py-2 pr-3">Categoría</th>
                      <th className="py-2 text-right">Monto</th>
                    </tr>
                  </thead>

                  <tbody>
                    {latestMovements.map((movement) => (
                      <tr
                        key={movement.id_movimiento_caja}
                        className="border-b"
                      >
                        <td className="py-2 pr-3">
                          {formatDate(movement.fecha_movimiento)}
                        </td>

                        <td className="py-2 pr-3">
                          <Badge
                            variant={getMovementBadgeVariant(
                              movement.tipo_movimiento,
                            )}
                          >
                            {getMovementLabel(movement.tipo_movimiento)}
                          </Badge>
                        </td>

                        <td className="py-2 pr-3">{movement.concepto}</td>

                        <td className="py-2 pr-3">
                          {movement.caja_chica.nombre_caja}
                        </td>

                        <td className="py-2 pr-3">
                          {movement.categoria_gasto?.nombre_categoria ?? "-"}
                        </td>

                        <td className="py-2 text-right font-medium">
                          {formatMoney(movement.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas cajas chicas</CardTitle>
          </CardHeader>

          <CardContent>
            {latestBoxes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no se registraron cajas chicas.
              </p>
            ) : (
              <div className="space-y-3">
                {latestBoxes.map((box) => (
                  <div
                    key={box.id_caja_chica}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{box.nombre_caja}</p>
                      <Badge variant="secondary">{box.estado}</Badge>
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Apertura: {formatDate(box.fecha_apertura)}
                    </p>

                    <p className="mt-1 text-sm">
                      Saldo actual:{" "}
                      <span className="font-medium">
                        {formatMoney(box.saldo_actual)}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">

        <Link href="/dashboard/petty-cash/boxes" className="block">
          <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">
                Listado de cajas chicas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Consultar cajas abiertas, cerradas, responsables, saldos y movimientos.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/petty-cash/boxes/new" className="block">
          <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Abrir caja chica</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Registrar una nueva caja con saldo inicial y responsable.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/petty-cash/expenses/new" className="block">
          <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">
                Registrar egreso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Registrar gastos menores, descontar saldo de caja y clasificar el egreso
                por categoría.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/petty-cash/income-adjustments/new" className="block">
          <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">
                Registrar ingreso o ajuste
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Registrar ingresos menores, ajustes positivos o ajustes negativos de
                caja chica.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/petty-cash/movements" className="block">
          <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">
                Movimientos de caja
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Consultar ingresos, egresos y ajustes con filtros por caja, tipo,
                categoría, fechas y concepto.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/petty-cash/monthly-summary" className="block">
          <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">
                Resumen mensual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Consultar ventas cobradas, saldos pendientes, costos, caja chica y
                utilidad estimada por mes.
              </p>
            </CardContent>
          </Card>
        </Link>


        <Link href="/dashboard/petty-cash/categories" className="block">
          <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Categorías de gasto</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Administrar categorías como repuestos, transporte,
                mantenimiento, refrigerios y otros.
              </p>
            </CardContent>
          </Card>
        </Link>
      </section>
    </main>
  );
}