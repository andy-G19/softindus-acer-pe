import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
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
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
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
    "destructive" | "warning" | "success"
  > = {
    alto: "destructive",
    medio: "warning",
    bajo: "success",
  };

  return variants[risk] ?? "warning";
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
      <PageHeader
        title="Reincidencias y reportes básicos"
        description="Analiza máquinas con mayor número de fallas, horas perdidas, costo acumulado de reparaciones y mantenimientos preventivos vencidos."
        backHref={navigationHrefs.maintenance}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Reincidencias" },
        ])}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/maintenance/failures">Ver fallas</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/maintenance/repairs">
                Ver reparaciones
              </Link>
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Fallas totales" value={totalFailures.toString()} description={`Este mes: ${monthlyFailures}`} tone="info" />
        <KpiCard title="Fallas abiertas" value={pendingFailuresCount.toString()} description="Pendientes o en atención." tone={pendingFailuresCount > 0 ? "warning" : "info"} />
        <KpiCard title="Horas perdidas" value={formatHours(totalLostHours)} description="Acumuladas por fallas." tone="warning" />
        <KpiCard title="Costo acumulado" value={formatMoney(totalRepairCost)} description={`Este mes: ${formatMoney(monthlyRepairCost._sum.costo_total)}`} tone="info" />
        <KpiCard title="Preventivos vencidos" value={overduePreventiveCount.toString()} description="Requieren atención." tone={overduePreventiveCount > 0 ? "warning" : "info"} />
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
              <EmptyState label="Aún no hay fallas registradas para generar este ranking." />
            ) : (
              <div className="space-y-3">
                {topFailureMachines.map((machine, index) => (
                  <div
                    key={machine.id_maquina}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-secondary/40 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {index + 1}. {machine.nombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {machine.tipo} · {machine.codigo_interno ?? "Sin código"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
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
              <EmptyState label="Aún no hay reparaciones con costo registrado." />
            ) : (
              <div className="space-y-3">
                {topCostMachines.map((machine, index) => (
                  <div
                    key={machine.id_maquina}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-secondary/40 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {index + 1}. {machine.nombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {machine.tipo} · {machine.codigo_interno ?? "Sin código"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
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

        <CardContent className="px-0">
          {machineReports.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="Aún no hay máquinas registradas."
              description="Registra máquinas, fallas y reparaciones para generar reportes de reincidencia."
              action={
                <Button asChild>
                  <Link href="/dashboard/maintenance/machines/new">
                    Registrar máquina
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Fallas</TableHead>
                  <TableHead className="text-right">Abiertas</TableHead>
                  <TableHead className="text-right">Reparadas</TableHead>
                  <TableHead className="text-right">Horas perdidas</TableHead>
                  <TableHead className="text-right">Costo reparación</TableHead>
                  <TableHead className="text-right">Preventivos</TableHead>
                  <TableHead className="text-right">Vencidos</TableHead>
                  <TableHead>Última falla</TableHead>
                  <TableHead className="text-right">Riesgo</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {machineReports.map((machine) => (
                  <TableRow key={machine.id_maquina} className="align-top">
                    <TableCell className="font-medium">
                      {machine.nombre}
                      <p className="text-xs font-normal text-muted-foreground">
                        {machine.tipo} · {machine.ubicacion ?? "Sin ubicación"}
                      </p>
                    </TableCell>

                    <TableCell>{getMachineStatusLabel(machine.estado)}</TableCell>

                    <TableCell className="text-right">
                      {machine.failureCount}
                    </TableCell>

                    <TableCell className="text-right">
                      {machine.openFailures}
                    </TableCell>

                    <TableCell className="text-right">
                      {machine.repairedFailures}
                    </TableCell>

                    <TableCell className="text-right">
                      {formatHours(machine.lostHours)}
                    </TableCell>

                    <TableCell className="text-right">
                      {formatMoney(machine.totalRepairCost)}
                    </TableCell>

                    <TableCell className="text-right">
                      {machine.preventiveCount}
                    </TableCell>

                    <TableCell className="text-right">
                      {machine.overduePreventives}
                    </TableCell>

                    <TableCell>{formatDate(machine.lastFailureDate)}</TableCell>

                    <TableCell className="text-right">
                      <Badge variant={getRiskBadgeVariant(machine.risk)}>
                        {getRiskLabel(machine.risk)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        <KpiCard title="Máquinas críticas" value={criticalMachines.length.toString()} description="Riesgo alto por fallas, horas perdidas o costo acumulado." tone="warning" />
        <KpiCard title="Máquinas reincidentes" value={recurrentMachines.length.toString()} description="Máquinas con 3 o más fallas registradas." tone="warning" />
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