import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
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
import {
  buildDateRangeFilter,
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";
import { updatePreventiveMaintenanceStatusAction } from "@/modules/maintenance/preventive/actions";

type PreventiveMaintenancePageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

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

function getPreventiveStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    realizado: "Realizado",
    vencido: "Vencido",
    anulado: "Anulado",
  };

  return labels[status] ?? status;
}

function getPreventiveStatusBadgeVariant(status: string) {
  const variants: Record<
    string,
    "warning" | "secondary" | "destructive" | "success"
  > = {
    pendiente: "warning",
    realizado: "success",
    vencido: "destructive",
    anulado: "secondary",
  };

  return variants[status] ?? "secondary";
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

export default async function PreventiveMaintenancePage({
  searchParams,
}: PreventiveMaintenancePageProps) {
  const session = await requireRole([APP_ROLES.ADMIN]);

  const canManagePreventive = session.user.role === APP_ROLES.ADMIN;
  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const machine = parseStringParam(params, "machine");
  const responsible = parseStringParam(params, "responsible");
  const status = parseStringParam(params, "status");
  const dateRange = buildDateRangeFilter(
    parseDateParam(params, "from"),
    parseDateParam(params, "to"),
  );

  const filters: Prisma.mantenimiento_preventivoWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { id_mantenimiento: { contains: q, mode: "insensitive" } },
        { actividad: { contains: q, mode: "insensitive" } },
        { responsable: { contains: q, mode: "insensitive" } },
        {
          maquina: {
            nombre: { contains: q, mode: "insensitive" },
          },
        },
      ],
    });
  }

  if (machine) {
    filters.push({
      maquina: {
        nombre: { contains: machine, mode: "insensitive" },
      },
    });
  }

  if (responsible) {
    filters.push({
      responsable: { contains: responsible, mode: "insensitive" },
    });
  }

  if (status) {
    filters.push({ estado: status });
  }

  if (dateRange) {
    filters.push({ fecha_programada: dateRange });
  }

  const where: Prisma.mantenimiento_preventivoWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const today = new Date();

  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const maintenances = await prisma.mantenimiento_preventivo.findMany({
    where,
    orderBy: [
      {
        fecha_programada: "asc",
      },
      {
        estado: "asc",
      },
    ],
    include: {
      maquina: true,
      usuario: true,
    },
  });

  const pendingMaintenances = maintenances.filter(
    (maintenance) => maintenance.estado === "pendiente",
  );

  const completedMaintenances = maintenances.filter(
    (maintenance) => maintenance.estado === "realizado",
  );

  const overdueMaintenances = maintenances.filter((maintenance) => {
    return (
      maintenance.estado === "pendiente" &&
      maintenance.fecha_programada < startOfToday
    );
  });

  const cancelledMaintenances = maintenances.filter(
    (maintenance) => maintenance.estado === "anulado",
  );

  return (
    <main className="space-y-6">
      <PageHeader
        title="Mantenimientos preventivos"
        description="Programa y consulta mantenimientos preventivos por máquina, responsable, fecha programada, fecha realizada y estado de cumplimiento."
        backHref={navigationHrefs.maintenance}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Preventivos" },
        ])}
        actions={
          canManagePreventive ? (
            <Button asChild>
              <Link href="/dashboard/maintenance/preventive/new">
                Programar preventivo
              </Link>
            </Button>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros de búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
            <div className="space-y-2">
              <Label htmlFor="q">Buscar</Label>
              <Input id="q" name="q" defaultValue={q} placeholder="Buscar mantenimiento o actividad" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="machine">Máquina</Label>
              <Input id="machine" name="machine" defaultValue={machine} placeholder="Maquina" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsible">Responsable</Label>
              <Input id="responsible" name="responsible" defaultValue={responsible} placeholder="Responsable" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <NativeSelect id="status" name="status" defaultValue={status}>
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="realizado">Realizado</option>
                <option value="vencido">Vencido</option>
                <option value="anulado">Anulado</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="from">Desde</Label>
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={parseStringParam(params, "from")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">Hasta</Label>
              <Input
                id="to"
                name="to"
                type="date"
                defaultValue={parseStringParam(params, "to")}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" className="flex-1">
                Filtrar
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/maintenance/preventive">Limpiar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Preventivos registrados" value={maintenances.length.toString()} description="Total histórico de programaciones." tone="info" />
        <KpiCard title="Pendientes" value={pendingMaintenances.length.toString()} description={`Vencidos: ${overdueMaintenances.length}`} tone={overdueMaintenances.length > 0 ? "warning" : "info"} />
        <KpiCard title="Realizados" value={completedMaintenances.length.toString()} description="Cumplidos según registro." tone="success" />
        <KpiCard title="Anulados" value={cancelledMaintenances.length.toString()} description="Programaciones canceladas." tone="info" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Programaciones preventivas
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {maintenances.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="Aún no hay mantenimientos preventivos registrados."
              description="Programa el primer mantenimiento preventivo para anticipar fallas y reducir paradas imprevistas."
              action={
                canManagePreventive ? (
                  <Button asChild>
                    <Link href="/dashboard/maintenance/preventive/new">
                      Programar primer preventivo
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Actividad</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Programada</TableHead>
                  <TableHead>Realizada</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                  {canManagePreventive ? (
                    <TableHead className="text-right">Cambiar estado</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>

              <TableBody>
                {maintenances.map((maintenance) => {
                  const isOverdue =
                    maintenance.estado === "pendiente" &&
                    maintenance.fecha_programada < startOfToday;

                  return (
                    <TableRow key={maintenance.id_mantenimiento} className="align-top">
                      <TableCell className="font-mono text-xs">
                        {maintenance.id_mantenimiento}
                      </TableCell>

                      <TableCell className="font-medium">
                        {maintenance.maquina.nombre}
                        <p className="text-xs font-normal text-muted-foreground">
                          {maintenance.maquina.tipo} ·{" "}
                          {getMachineStatusLabel(maintenance.maquina.estado)}
                        </p>
                      </TableCell>

                      <TableCell>
                        <p className="max-w-md">{maintenance.actividad}</p>
                        {maintenance.observaciones ? (
                          <p className="mt-1 max-w-md text-xs text-muted-foreground">
                            {maintenance.observaciones}
                          </p>
                        ) : null}
                      </TableCell>

                      <TableCell>{maintenance.responsable ?? "-"}</TableCell>

                      <TableCell>
                        {formatDate(maintenance.fecha_programada)}
                        {isOverdue ? (
                          <p className="text-xs text-destructive">Vencido</p>
                        ) : null}
                      </TableCell>

                      <TableCell>{formatDate(maintenance.fecha_realizada)}</TableCell>

                      <TableCell>
                        {maintenance.usuario.nombres}{" "}
                        {maintenance.usuario.apellidos}
                      </TableCell>

                      <TableCell className="text-right">
                        <Badge
                          variant={getPreventiveStatusBadgeVariant(
                            isOverdue ? "vencido" : maintenance.estado,
                          )}
                        >
                          {isOverdue
                            ? "Vencido"
                            : getPreventiveStatusLabel(maintenance.estado)}
                        </Badge>
                      </TableCell>

                      {canManagePreventive ? (
                        <TableCell className="text-right">
                          {["realizado", "anulado"].includes(
                            maintenance.estado,
                          ) ? (
                            <span className="text-xs text-muted-foreground">
                              Sin accion
                            </span>
                          ) : (
                            <form
                              action={updatePreventiveMaintenanceStatusAction}
                              className="flex justify-end gap-2"
                            >
                              <input
                                type="hidden"
                                name="id_mantenimiento"
                                value={maintenance.id_mantenimiento}
                              />

                              <NativeSelect
                                name="estado"
                                defaultValue={
                                  isOverdue ? "vencido" : maintenance.estado
                                }
                                className="h-8 text-xs"
                              >
                                <option value="pendiente">Pendiente</option>
                                <option value="realizado">Realizado</option>
                                <option value="vencido">Vencido</option>
                                <option value="anulado">Anulado</option>
                              </NativeSelect>

                              <Button type="submit" variant="outline" size="sm">
                                Guardar
                              </Button>
                            </form>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
