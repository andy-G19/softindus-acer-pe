import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { ModuleAccessCard } from "@/components/ui/module-access-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { dashboardBreadcrumbs } from "@/lib/navigation";
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
    return "success" as const;
  }

  if (type === "egreso") {
    return "destructive" as const;
  }

  return "secondary" as const;
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

  const modules = [
    {
      title: "Listado de cajas chicas",
      href: "/dashboard/petty-cash/boxes",
      description: "Consultar cajas abiertas, cerradas, responsables, saldos y movimientos.",
    },
    {
      title: "Abrir caja chica",
      href: "/dashboard/petty-cash/boxes/new",
      description: "Registrar una nueva caja con saldo inicial y responsable.",
    },
    {
      title: "Registrar egreso",
      href: "/dashboard/petty-cash/expenses/new",
      description: "Registrar gastos menores, descontar saldo de caja y clasificar el egreso por categoría.",
    },
    {
      title: "Registrar ingreso o ajuste",
      href: "/dashboard/petty-cash/income-adjustments/new",
      description: "Registrar ingresos menores, ajustes positivos o ajustes negativos de caja chica.",
    },
    {
      title: "Movimientos de caja",
      href: "/dashboard/petty-cash/movements",
      description: "Consultar ingresos, egresos y ajustes con filtros por caja, tipo, categoría, fechas y concepto.",
    },
    {
      title: "Resumen mensual",
      href: "/dashboard/petty-cash/monthly-summary",
      description: "Consultar ventas cobradas, saldos pendientes, costos, caja chica y utilidad estimada por mes.",
    },
    {
      title: "Categorías de gasto",
      href: "/dashboard/petty-cash/categories",
      description: "Administrar categorías como repuestos, transporte, mantenimiento, refrigerios y otros.",
    },
  ];

  return (
    <main className="space-y-6">
      <PageHeader
        title="Caja chica"
        description="Controla cajas chicas, ingresos menores, egresos, categorías de gasto y movimientos financieros menores del taller."
        breadcrumbs={dashboardBreadcrumbs([{ label: "Caja chica" }])}
      />

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Saldo actual abierto" value={formatMoney(totalCurrentBalance)} description="Suma de saldos de cajas abiertas." tone="info" />
        <KpiCard title="Ingresos del mes" value={formatMoney(totalMonthlyIncome)} description="Incluye ingresos menores y ventas de chatarra vinculadas." tone="success" />
        <KpiCard title="Egresos del mes" value={formatMoney(totalMonthlyExpenses)} description="Gastos menores registrados en caja chica." tone="warning" />
        <KpiCard title="Resultado mensual" value={formatMoney(monthlyResult)} description="Ingresos menos egresos del mes actual." tone="info" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Cajas abiertas" value={openBoxes.toString()} description="Total de cajas chicas actualmente abiertas." tone="info" />
        <KpiCard title="Cajas registradas" value={totalBoxes.toString()} description="Historial total de cajas creadas." tone="info" />
        <KpiCard title="Categorías activas" value={activeCategories.toString()} description="Disponibles para clasificar egresos." tone="info" />
        <KpiCard title="Movimientos del mes" value={monthlyMovements.toString()} description="Ingresos, egresos y ajustes registrados este mes." tone="info" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Últimos movimientos de caja
            </CardTitle>
          </CardHeader>

          <CardContent className="px-0">
            {latestMovements.length === 0 ? (
              <EmptyState
                className="mx-6 border-0"
                label="Aún no hay movimientos de caja registrados."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Caja</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {latestMovements.map((movement) => (
                    <TableRow key={movement.id_movimiento_caja}>
                      <TableCell>{formatDate(movement.fecha_movimiento)}</TableCell>
                      <TableCell>
                        <Badge variant={getMovementBadgeVariant(movement.tipo_movimiento)}>
                          {getMovementLabel(movement.tipo_movimiento)}
                        </Badge>
                      </TableCell>
                      <TableCell>{movement.concepto}</TableCell>
                      <TableCell>{movement.caja_chica.nombre_caja}</TableCell>
                      <TableCell>
                        {movement.categoria_gasto?.nombre_categoria ?? "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(movement.monto)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas cajas chicas</CardTitle>
          </CardHeader>

          <CardContent>
            {latestBoxes.length === 0 ? (
              <EmptyState label="Aún no se registraron cajas chicas." />
            ) : (
              <div className="space-y-3">
                {latestBoxes.map((box) => (
                  <div
                    key={box.id_caja_chica}
                    className="rounded-lg border border-border/80 bg-secondary/40 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-foreground">
                        {box.nombre_caja}
                      </p>
                      <Badge variant="secondary">{box.estado}</Badge>
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Apertura: {formatDate(box.fecha_apertura)}
                    </p>

                    <p className="mt-1 text-sm">
                      Saldo actual:{" "}
                      <span className="font-medium text-foreground">
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

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {modules.map((module) => (
          <ModuleAccessCard
            key={module.href}
            title={module.title}
            description={module.description}
            href={module.href}
          />
        ))}
      </section>
    </main>
  );
}
