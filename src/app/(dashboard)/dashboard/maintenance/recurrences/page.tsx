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

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatMoney(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
}

function formatHours(value: unknown) {
  return `${toNumber(value).toFixed(2)} h`;
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

function getMachineStatusLabel(status: string) {
  const labels: Record<string, string> = {
    operativa: "Operativa",
    en_reparacion: "En mantenimiento",
    inactiva: "Inactiva",
    dada_de_baja: "Fuera de servicio",
  };

  return labels[status] ?? status;
}

function getRiskLevel(failureCount: number, lostHours: number, totalCost: number) {
  if (failureCount >= 5 || lostHours >= 20 || totalCost >= 1000) {
    return "alto";
  }

  if (failureCount >= 3 || lostHours >= 8 || totalCost >= 300) {
    return "medio";
  }

  return "bajo";
}

function getRiskLabel(risk: string) {
  const labels: Record<string, string> = {
    alto: "Alto",
    medio: "Medio",
    bajo: "Bajo",
  };

  return labels[risk] ?? risk;
}

function getRiskBadgeVariant(risk: string) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    alto: "destructive",
    medio: "secondary",
    bajo: "outline",
  };

  return variants[risk] ?? "secondary";
}

export default async function MaintenanceRecurrencesPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const today = new Date();

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const machines = await prisma.maquina.findMany({
    orderBy: {
      nombre: "asc",
    },
    include: {
      falla_maquina: {
        include: {
          reparacion: true,
        },
      },
      mantenimiento_preventivo: true,
    },
  });

  const monthlyFailures = await prisma.falla_maquina.count({
    where: {
      fecha_falla: {
        gte: startOfMonth,
      },
    },
  });

  const monthlyRepairCost = await prisma.reparacion.aggregate({
    where: {
      fecha_reparacion: {
        gte: startOfMonth,
      },
    },
    _sum: {
      costo_total: true,
    },
  });

  const overduePreventiveCount = await prisma.mantenimiento_preventivo.count({
    where: {
      estado: "pendiente",
      fecha_programada: {
        lt: startOfToday,
      },
    },
  });

  const pendingFailuresCount = await prisma.falla_maquina.count({
    where: {
      estado_atencion: {
        in: ["pendiente", "en_atencion"],
      },
    },
  });

  const machineReports = machines
    .map((machine) => {
      const failureCount = machine.falla_maquina.length;

      const openFailures = machine.falla_maquina.filter((failure) =>
        ["pendiente", "en_atencion"].includes(failure.estado_atencion),
      ).length;

      const repairedFailures = machine.falla_maquina.filter(
        (failure) => failure.estado_atencion === "reparada",
      ).length;

      const lostHours = machine.falla_maquina.reduce((total, failure) => {
        return total + toNumber(failure.tiempo_perdido_horas);
      }, 0);

      const totalRepairCost = machine.falla_maquina.reduce((total, failure) => {
        const failureRepairCost = failure.reparacion.reduce(
          (repairTotal, repair) => {
            return repairTotal + toNumber(repair.costo_total);
          },
          0,
        );

        return total + failureRepairCost;
      }, 0);

      const preventiveCount = machine.mantenimiento_preventivo.length;

      const pendingPreventives = machine.mantenimiento_preventivo.filter(
        (maintenance) => maintenance.estado === "pendiente",
      ).length;

      const overduePreventives = machine.mantenimiento_preventivo.filter(
        (maintenance) =>
          maintenance.estado === "pendiente" &&
          maintenance.fecha_programada < startOfToday,
      ).length;

      const lastFailure = machine.falla_maquina
        .slice()
        .sort(
          (a, b) =>
            b.fecha_falla.getTime() - a.fecha_falla.getTime(),
        )[0];

      const risk = getRiskLevel(failureCount, lostHours, totalRepairCost);

      return {
        id_maquina: machine.id_maquina,
        nombre: machine.nombre,
        tipo: machine.tipo,
        codigo_interno: machine.codigo_interno,
        ubicacion: machine.ubicacion,
        estado: machine.estado,
        failureCount,
        openFailures,
        repairedFailures,
        lostHours,
        totalRepairCost,
        preventiveCount,
        pendingPreventives,
        overduePreventives,
        lastFailureDate: lastFailure?.fecha_falla ?? null,
        risk,
      };
    })
    .sort((a, b) => {
      if (b.failureCount !== a.failureCount) {
        return b.failureCount - a.failureCount;
      }

      if (b.lostHours !== a.lostHours) {
        return b.lostHours - a.lostHours;
      }

      return b.totalRepairCost - a.totalRepairCost;
    });

  const criticalMachines = machineReports.filter(
    (machine) => machine.risk === "alto",
  );

  const recurrentMachines = machineReports.filter(
    (machine) => machine.failureCount >= 3,
  );

  const totalFailures = machineReports.reduce((total, machine) => {
    return total + machine.failureCount;
  }, 0);

  const totalLostHours = machineReports.reduce((total, machine) => {
    return total + machine.lostHours;
  }, 0);

  const totalRepairCost = machineReports.reduce((total, machine) => {
    return total + machine.totalRepairCost;
  }, 0);

  const topFailureMachines = machineReports
    .filter((machine) => machine.failureCount > 0)
    .slice(0, 5);

  const topCostMachines = machineReports
    .filter((machine) => machine.totalRepairCost > 0)
    .slice()
    .sort((a, b) => b.totalRepairCost - a.totalRepairCost)
    .slice(0, 5);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Mantenimiento de maquinaria · Reincidencias
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Reincidencias y reportes básicos
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Analiza máquinas con mayor número de fallas, horas perdidas, costo
            acumulado de reparaciones y mantenimientos preventivos vencidos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/maintenance"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al módulo
          </Link>

          <Link
            href="/dashboard/maintenance/failures"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Ver fallas
          </Link>

          <Link
            href="/dashboard/maintenance/repairs"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Ver reparaciones
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fallas totales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalFailures}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Este mes: {monthlyFailures}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fallas abiertas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingFailuresCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pendientes o en atención.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horas perdidas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatHours(totalLostHours)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Acumuladas por fallas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Costo acumulado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(totalRepairCost)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Este mes: {formatMoney(monthlyRepairCost._sum.costo_total)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preventivos vencidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{overduePreventiveCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Requieren atención.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Top 5 máquinas con más fallas
            </CardTitle>
          </CardHeader>

          <CardContent>
            {topFailureMachines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay fallas registradas para generar este ranking.
              </p>
            ) : (
              <div className="space-y-3">
                {topFailureMachines.map((machine, index) => (
                  <div
                    key={machine.id_maquina}
                    className="flex items-center justify-between gap-4 rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {index + 1}. {machine.nombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {machine.tipo} · {machine.codigo_interno ?? "Sin código"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {machine.failureCount} fallas
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatHours(machine.lostHours)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Top 5 máquinas por costo de reparación
            </CardTitle>
          </CardHeader>

          <CardContent>
            {topCostMachines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay reparaciones con costo registrado.
              </p>
            ) : (
              <div className="space-y-3">
                {topCostMachines.map((machine, index) => (
                  <div
                    key={machine.id_maquina}
                    className="flex items-center justify-between gap-4 rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {index + 1}. {machine.nombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {machine.tipo} · {machine.codigo_interno ?? "Sin código"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {formatMoney(machine.totalRepairCost)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {machine.failureCount} fallas
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Reporte general por máquina
          </CardTitle>
        </CardHeader>

        <CardContent>
          {machineReports.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm font-medium">
                Aún no hay máquinas registradas.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Registra máquinas, fallas y reparaciones para generar reportes
                de reincidencia.
              </p>

              <Link
                href="/dashboard/maintenance/machines/new"
                className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Registrar máquina
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Máquina</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 pr-3 text-right">Fallas</th>
                    <th className="py-2 pr-3 text-right">Abiertas</th>
                    <th className="py-2 pr-3 text-right">Reparadas</th>
                    <th className="py-2 pr-3 text-right">Horas perdidas</th>
                    <th className="py-2 pr-3 text-right">Costo reparación</th>
                    <th className="py-2 pr-3 text-right">Preventivos</th>
                    <th className="py-2 pr-3 text-right">Vencidos</th>
                    <th className="py-2 pr-3">Última falla</th>
                    <th className="py-2 text-right">Riesgo</th>
                  </tr>
                </thead>

                <tbody>
                  {machineReports.map((machine) => (
                    <tr key={machine.id_maquina} className="border-b align-top">
                      <td className="py-2 pr-3 font-medium">
                        {machine.nombre}
                        <p className="text-xs font-normal text-muted-foreground">
                          {machine.tipo} · {machine.ubicacion ?? "Sin ubicación"}
                        </p>
                      </td>

                      <td className="py-2 pr-3">
                        {getMachineStatusLabel(machine.estado)}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {machine.failureCount}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {machine.openFailures}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {machine.repairedFailures}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {formatHours(machine.lostHours)}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {formatMoney(machine.totalRepairCost)}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {machine.preventiveCount}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {machine.overduePreventives}
                      </td>

                      <td className="py-2 pr-3">
                        {formatDate(machine.lastFailureDate)}
                      </td>

                      <td className="py-2 text-right">
                        <Badge variant={getRiskBadgeVariant(machine.risk)}>
                          {getRiskLabel(machine.risk)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Máquinas críticas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{criticalMachines.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Riesgo alto por fallas, horas perdidas o costo acumulado.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Máquinas reincidentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{recurrentMachines.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Máquinas con 3 o más fallas registradas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Criterio de riesgo usado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>
              Alto: 5 o más fallas, 20 h perdidas o S/ 1000 en reparaciones.
            </p>
            <p>
              Medio: 3 o más fallas, 8 h perdidas o S/ 300 en reparaciones.
            </p>
            <p>Bajo: por debajo de los umbrales anteriores.</p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}