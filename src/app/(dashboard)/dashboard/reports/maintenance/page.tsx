import Link from "next/link";
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
import { formatDateTime } from "@/lib/formatters";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { buildReportExportHref } from "@/lib/report-export-link";

const FAILURE_STATUS_OPTIONS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_atencion", label: "En atención" },
  { value: "reparada", label: "Reparada" },
  { value: "anulada", label: "Anulada" },
];

const REPAIR_STATUS_OPTIONS = [
  { value: "programada", label: "Programada" },
  { value: "ejecutada", label: "Ejecutada" },
  { value: "observada", label: "Observada" },
  { value: "anulada", label: "Anulada" },
];

const PREVENTIVE_STATUS_OPTIONS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "realizado", label: "Realizado" },
  { value: "vencido", label: "Vencido" },
  { value: "anulado", label: "Anulado" },
];

const OPEN_FAILURE_STATES = ["pendiente", "en_atencion"];

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parseDateInput(value: string) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

function parseDateInputAsNextDay(value: string) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day + 1);
}

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

function formatQuantity(value: unknown) {
  return toNumber(value).toFixed(2);
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function getFailureStatusLabel(status: string) {
  return (
    FAILURE_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

function getRepairStatusLabel(status: string) {
  return (
    REPAIR_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

function getPreventiveStatusLabel(status: string) {
  return (
    PREVENTIVE_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

function getRepairCost(
  repairs: {
    costo_total: unknown;
  }[],
) {
  return repairs.reduce((sum, repair) => {
    return sum + toNumber(repair.costo_total);
  }, 0);
}

function getSparePartCost(
  details: {
    subtotal: unknown;
  }[],
) {
  return details.reduce((sum, detail) => {
    return sum + toNumber(detail.subtotal);
  }, 0);
}

export default async function MaintenanceReportPage({
  searchParams,
}: PageProps) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const params = searchParams ? await searchParams : {};

  const dateFrom = getSearchParam(params, "dateFrom");
  const dateTo = getSearchParam(params, "dateTo");
  const machineId = getSearchParam(params, "machineId");
  const failureStatus = getSearchParam(params, "failureStatus");
  const repairStatus = getSearchParam(params, "repairStatus");
  const preventiveStatus = getSearchParam(params, "preventiveStatus");
  const searchText = getSearchParam(params, "searchText").trim();

  const csvExportHref = buildReportExportHref("maintenance", {
    dateFrom,
    dateTo,
    machineId,
    failureStatus,
    repairStatus,
    preventiveStatus,
    searchText,
  });

  const pdfExportHref = buildReportExportHref(
  "maintenance",
  {
    dateFrom,
    dateTo,
    machineId,
    failureStatus,
    repairStatus,
    preventiveStatus,
    searchText,
  },
  "pdf",
  );

  const fromDate = parseDateInput(dateFrom);
  const toDate = parseDateInputAsNextDay(dateTo);

  const dateRangeFilter =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lt: toDate } : {}),
        }
      : undefined;

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const failureWhere = {
    ...(dateRangeFilter
      ? {
          fecha_falla: dateRangeFilter,
        }
      : {}),
    ...(machineId ? { id_maquina: machineId } : {}),
    ...(failureStatus ? { estado_atencion: failureStatus } : {}),
    ...(repairStatus
      ? {
          reparacion: {
            some: {
              estado_reparacion: repairStatus,
            },
          },
        }
      : {}),
    ...(searchText
      ? {
          OR: [
            {
              descripcion: {
                contains: searchText,
                mode: "insensitive" as const,
              },
            },
            {
              responsable_registro: {
                contains: searchText,
                mode: "insensitive" as const,
              },
            },
            {
              impacto_produccion: {
                contains: searchText,
                mode: "insensitive" as const,
              },
            },
            {
              maquina: {
                nombre: {
                  contains: searchText,
                  mode: "insensitive" as const,
                },
              },
            },
            {
              maquina: {
                codigo_interno: {
                  contains: searchText,
                  mode: "insensitive" as const,
                },
              },
            },
          ],
        }
      : {}),
  };

  const repairWhere = {
    ...(dateRangeFilter
      ? {
          fecha_reparacion: dateRangeFilter,
        }
      : {}),
    ...(repairStatus ? { estado_reparacion: repairStatus } : {}),
    ...(machineId
      ? {
          falla_maquina: {
            id_maquina: machineId,
          },
        }
      : {}),
  };

  const preventiveWhere = {
    ...(dateRangeFilter
      ? {
          fecha_programada: dateRangeFilter,
        }
      : {}),
    ...(machineId ? { id_maquina: machineId } : {}),
    ...(preventiveStatus ? { estado: preventiveStatus } : {}),
  };

  const [machines, failures, repairs, preventiveMaintenances] =
    await Promise.all([
      prisma.maquina.findMany({
        orderBy: {
          nombre: "asc",
        },
      }),

      prisma.falla_maquina.findMany({
        where: failureWhere,
        orderBy: {
          fecha_falla: "desc",
        },
        take: 100,
        include: {
          maquina: true,
          usuario: true,
          reparacion: {
            orderBy: {
              fecha_reparacion: "desc",
            },
            include: {
              detalle_repuesto_reparacion: {
                include: {
                  repuesto: true,
                },
              },
            },
          },
        },
      }),

      prisma.reparacion.findMany({
        where: repairWhere,
        orderBy: {
          fecha_reparacion: "desc",
        },
        take: 100,
        include: {
          falla_maquina: {
            include: {
              maquina: true,
            },
          },
          detalle_repuesto_reparacion: {
            include: {
              repuesto: true,
            },
          },
        },
      }),

      prisma.mantenimiento_preventivo.findMany({
        where: preventiveWhere,
        orderBy: {
          fecha_programada: "asc",
        },
        take: 100,
        include: {
          maquina: true,
          usuario: true,
        },
      }),
    ]);

  const totalFailures = failures.length;

  const openFailures = failures.filter((failure) => {
    return OPEN_FAILURE_STATES.includes(failure.estado_atencion);
  }).length;

  const repairedFailures = failures.filter((failure) => {
    return failure.estado_atencion === "reparada";
  }).length;

  const totalLostHours = failures.reduce((sum, failure) => {
    return sum + toNumber(failure.tiempo_perdido_horas);
  }, 0);

  const totalRepairCost = repairs.reduce((sum, repair) => {
    return sum + toNumber(repair.costo_total);
  }, 0);

  const totalLaborCost = repairs.reduce((sum, repair) => {
    return sum + toNumber(repair.mano_obra);
  }, 0);

  const totalSparePartCost = repairs.reduce((sum, repair) => {
    return (
      sum + getSparePartCost(repair.detalle_repuesto_reparacion)
    );
  }, 0);

  const pendingPreventives = preventiveMaintenances.filter((maintenance) => {
    return maintenance.estado === "pendiente";
  }).length;

  const overduePreventives = preventiveMaintenances.filter((maintenance) => {
    return (
      maintenance.estado === "pendiente" &&
      maintenance.fecha_programada < startOfToday
    );
  }).length;

  const completedPreventives = preventiveMaintenances.filter((maintenance) => {
    return maintenance.estado === "realizado";
  }).length;

  const failuresByMachineMap = new Map<
    string,
    {
      machineId: string;
      machineName: string;
      machineType: string;
      machineStatus: string;
      failures: number;
      openFailures: number;
      lostHours: number;
      repairCost: number;
    }
  >();

  failures.forEach((failure) => {
    const machineData = failuresByMachineMap.get(failure.id_maquina) ?? {
      machineId: failure.id_maquina,
      machineName: failure.maquina.nombre,
      machineType: failure.maquina.tipo,
      machineStatus: failure.maquina.estado,
      failures: 0,
      openFailures: 0,
      lostHours: 0,
      repairCost: 0,
    };

    machineData.failures += 1;
    machineData.lostHours += toNumber(failure.tiempo_perdido_horas);
    machineData.repairCost += getRepairCost(failure.reparacion);

    if (OPEN_FAILURE_STATES.includes(failure.estado_atencion)) {
      machineData.openFailures += 1;
    }

    failuresByMachineMap.set(failure.id_maquina, machineData);
  });

  const machineRecurrences = Array.from(failuresByMachineMap.values()).sort(
    (a, b) => {
      if (b.failures !== a.failures) {
        return b.failures - a.failures;
      }

      return b.repairCost - a.repairCost;
    },
  );

  const recurrentMachines = machineRecurrences.filter((machine) => {
    return machine.failures >= 2;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reporte de mantenimiento"
        description="Consulta máquinas, fallas, reparaciones, costos, repuestos, mantenimientos preventivos y reincidencias por equipo."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Reportes", href: navigationHrefs.reports },
          { label: "Mantenimiento" },
        ])}
        actions={
          <>
            <Button asChild>
              <a href={csvExportHref}>Exportar Excel</a>
            </Button>

            <Button variant="destructive" asChild>
              <a href={pdfExportHref}>Exportar PDF</a>
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros del reporte</CardTitle>
        </CardHeader>

        <CardContent>
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Fecha desde</Label>
              <Input id="dateFrom" name="dateFrom" type="date" defaultValue={dateFrom} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">Fecha hasta</Label>
              <Input id="dateTo" name="dateTo" type="date" defaultValue={dateTo} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="machineId">Máquina</Label>
              <NativeSelect id="machineId" name="machineId" defaultValue={machineId}>
                <option value="">Todas las máquinas</option>
                {machines.map((machine) => (
                  <option key={machine.id_maquina} value={machine.id_maquina}>
                    {machine.nombre}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="failureStatus">Estado falla</Label>
              <NativeSelect id="failureStatus" name="failureStatus" defaultValue={failureStatus}>
                <option value="">Todos</option>
                {FAILURE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="repairStatus">Estado reparación</Label>
              <NativeSelect id="repairStatus" name="repairStatus" defaultValue={repairStatus}>
                <option value="">Todos</option>
                {REPAIR_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preventiveStatus">Estado preventivo</Label>
              <NativeSelect id="preventiveStatus" name="preventiveStatus" defaultValue={preventiveStatus}>
                <option value="">Todos</option>
                {PREVENTIVE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="searchText">Buscar</Label>
              <Input
                id="searchText"
                name="searchText"
                type="text"
                defaultValue={searchText}
                placeholder="Máquina, falla, responsable..."
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-7">
              <Button type="submit">Aplicar filtros</Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/reports/maintenance">
                  Limpiar filtros
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Fallas registradas" value={totalFailures.toString()} description="Fallas encontradas según los filtros aplicados." tone="info" />
        <KpiCard title="Fallas abiertas" value={openFailures.toString()} description="Fallas pendientes o en atención." tone={openFailures > 0 ? "warning" : "info"} />
        <KpiCard title="Fallas reparadas" value={repairedFailures.toString()} description="Fallas marcadas como reparadas." tone="success" />
        <KpiCard title="Tiempo perdido" value={formatHours(totalLostHours)} description="Horas perdidas por fallas registradas." tone="warning" />
        <KpiCard title="Costo reparación" value={formatMoney(totalRepairCost)} description="Costo total de reparaciones filtradas." tone="info" />
        <KpiCard title="Mano de obra" value={formatMoney(totalLaborCost)} description="Costo de mano de obra en reparaciones." tone="info" />
        <KpiCard title="Costo repuestos" value={formatMoney(totalSparePartCost)} description="Subtotal de repuestos usados." tone="info" />
        <KpiCard title="Máquinas reincidentes" value={recurrentMachines.toString()} description="Máquinas con dos o más fallas en el reporte." tone={recurrentMachines > 0 ? "warning" : "info"} />
        <KpiCard title="Preventivos pendientes" value={pendingPreventives.toString()} description={`Preventivos vencidos: ${overduePreventives}.`} tone={overduePreventives > 0 ? "warning" : "info"} />
        <KpiCard title="Preventivos realizados" value={completedPreventives.toString()} description="Mantenimientos preventivos completados." tone="success" />
        <KpiCard title="Reparaciones" value={repairs.length.toString()} description="Reparaciones encontradas en el periodo." tone="info" />
        <KpiCard title="Máquinas afectadas" value={machineRecurrences.length.toString()} description="Máquinas con al menos una falla en el reporte." tone="info" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Reincidencias por máquina
            </CardTitle>
          </CardHeader>

          <CardContent>
            {machineRecurrences.length === 0 ? (
              <EmptyState label="No hay reincidencias o fallas registradas con los filtros aplicados." />
            ) : (
              <div className="space-y-3">
                {machineRecurrences.slice(0, 8).map((machine) => (
                  <div
                    key={machine.machineId}
                    className="rounded-lg border border-border/80 bg-secondary/40 p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{machine.machineName}</p>
                        <p className="text-xs text-muted-foreground">
                          {machine.machineType} | {machine.machineStatus}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-foreground">{machine.failures} fallas</p>
                        <p className="text-xs text-muted-foreground">
                          Abiertas: {machine.openFailures}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                      <p>
                        Tiempo perdido:{" "}
                        <span className="font-medium">
                          {formatHours(machine.lostHours)}
                        </span>
                      </p>
                      <p>
                        Costo reparación:{" "}
                        <span className="font-medium">
                          {formatMoney(machine.repairCost)}
                        </span>
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
              Mantenimientos preventivos
            </CardTitle>
          </CardHeader>

          <CardContent>
            {preventiveMaintenances.length === 0 ? (
              <EmptyState label="No se encontraron mantenimientos preventivos con los filtros aplicados." />
            ) : (
              <div className="space-y-3">
                {preventiveMaintenances.slice(0, 8).map((maintenance) => {
                  const isOverdue =
                    maintenance.estado === "pendiente" &&
                    maintenance.fecha_programada < startOfToday;

                  return (
                    <div
                      key={maintenance.id_mantenimiento}
                      className="rounded-lg border border-border/80 bg-secondary/40 p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {maintenance.maquina.nombre}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {maintenance.actividad}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-bold text-foreground">
                            {formatDate(maintenance.fecha_programada)}
                          </p>
                          <p
                            className={`text-xs ${
                              isOverdue
                                ? "font-medium text-destructive"
                                : "text-muted-foreground"
                            }`}
                          >
                            {isOverdue
                              ? "Vencido"
                              : getPreventiveStatusLabel(maintenance.estado)}
                          </p>
                        </div>
                      </div>

                      <p className="mt-2 text-xs text-muted-foreground">
                        Responsable: {maintenance.responsable ?? "-"} | Usuario:{" "}
                        {maintenance.usuario.apellidos},{" "}
                        {maintenance.usuario.nombres}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Fallas y reparaciones
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {failures.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No se encontraron fallas con los filtros aplicados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Falla</TableHead>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Tiempo perdido</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Reparaciones</TableHead>
                  <TableHead>Repuestos</TableHead>
                  <TableHead>Responsable</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {failures.map((failure) => {
                  const failureRepairCost = getRepairCost(
                    failure.reparacion,
                  );

                  const spareDetails = failure.reparacion.flatMap((repair) => {
                    return repair.detalle_repuesto_reparacion;
                  });

                  return (
                    <TableRow key={failure.id_falla} className="align-top">
                      <TableCell className="font-medium">
                        {failure.id_falla}
                      </TableCell>

                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {failure.maquina.nombre}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {failure.maquina.tipo} ·{" "}
                            {failure.maquina.codigo_interno ?? "Sin código"}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>{formatDateTime(failure.fecha_falla)}</TableCell>

                      <TableCell>
                        {getFailureStatusLabel(failure.estado_atencion)}
                      </TableCell>

                      <TableCell>
                        {formatHours(failure.tiempo_perdido_horas)}
                      </TableCell>

                      <TableCell className="min-w-64">
                        <p>{failure.descripcion}</p>
                        {failure.impacto_produccion ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Impacto: {failure.impacto_produccion}
                          </p>
                        ) : null}
                      </TableCell>

                      <TableCell className="min-w-72">
                        {failure.reparacion.length === 0 ? (
                          <span className="text-muted-foreground">
                            Sin reparación
                          </span>
                        ) : (
                          <div className="space-y-2">
                            {failure.reparacion.map((repair) => (
                              <div
                                key={repair.id_reparacion}
                                className="rounded-md border border-border/80 bg-secondary/40 p-2"
                              >
                                <p className="font-medium">
                                  {repair.id_reparacion} |{" "}
                                  {getRepairStatusLabel(
                                    repair.estado_reparacion,
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(repair.fecha_reparacion)} |{" "}
                                  {repair.tecnico_proveedor ?? "Sin técnico"}{" "}
                                  | {formatMoney(repair.costo_total)}
                                </p>
                              </div>
                            ))}

                            <p className="text-xs font-medium">
                              Costo total: {formatMoney(failureRepairCost)}
                            </p>
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="min-w-64">
                        {spareDetails.length === 0 ? (
                          <span className="text-muted-foreground">
                            Sin repuestos
                          </span>
                        ) : (
                          <div className="space-y-2">
                            {spareDetails.map((detail) => (
                              <div
                                key={detail.id_detalle_repuesto}
                                className="rounded-md border border-border/80 bg-secondary/40 p-2"
                              >
                                <p className="font-medium">
                                  {detail.repuesto.nombre_repuesto}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatQuantity(detail.cantidad)} und ·{" "}
                                  {formatMoney(detail.costo_unitario)} c/u ·{" "}
                                  subtotal {formatMoney(detail.subtotal)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        <div>
                          <p>{failure.responsable_registro ?? "-"}</p>
                          <p className="text-xs text-muted-foreground">
                            {failure.usuario.apellidos},{" "}
                            {failure.usuario.nombres}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <p className="mt-3 px-6 text-xs text-muted-foreground">
            Se muestran como máximo 100 fallas, 100 reparaciones y 100
            mantenimientos preventivos para mantener una consulta rápida. En la
            subfase de exportación se generarán archivos completos según los
            filtros aplicados.
          </p>
        </CardContent>
      </Card>

      <section className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          Este reporte consolida la trazabilidad de mantenimiento: máquina,
          falla, tiempo perdido, impacto productivo, reparaciones, repuestos,
          costos, preventivos y reincidencias por equipo.
        </p>
      </section>
    </div>
  );
}

