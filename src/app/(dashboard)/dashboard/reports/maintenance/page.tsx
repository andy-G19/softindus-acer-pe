import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";

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
  }).format(value);
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

type SummaryCardProps = {
  title: string;
  value: string | number;
  description: string;
};

function SummaryCard({ title, value, description }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default async function MaintenanceReportPage({
  searchParams,
}: PageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = searchParams ? await searchParams : {};

  const dateFrom = getSearchParam(params, "dateFrom");
  const dateTo = getSearchParam(params, "dateTo");
  const machineId = getSearchParam(params, "machineId");
  const failureStatus = getSearchParam(params, "failureStatus");
  const repairStatus = getSearchParam(params, "repairStatus");
  const preventiveStatus = getSearchParam(params, "preventiveStatus");
  const searchText = getSearchParam(params, "searchText").trim();

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
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Fase 10 · Subfase 10.3.6
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Reporte de mantenimiento
          </h1>
          <p className="mt-2 max-w-4xl text-muted-foreground">
            Consulta máquinas, fallas, reparaciones, costos, repuestos,
            mantenimientos preventivos y reincidencias por equipo.
          </p>
        </div>

        <Link
          href="/dashboard/reports"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Volver al dashboard
        </Link>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros del reporte</CardTitle>
        </CardHeader>

        <CardContent>
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            <div className="space-y-2">
              <label htmlFor="dateFrom" className="text-sm font-medium">
                Fecha desde
              </label>
              <input
                id="dateFrom"
                name="dateFrom"
                type="date"
                defaultValue={dateFrom}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="dateTo" className="text-sm font-medium">
                Fecha hasta
              </label>
              <input
                id="dateTo"
                name="dateTo"
                type="date"
                defaultValue={dateTo}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="machineId" className="text-sm font-medium">
                Máquina
              </label>
              <select
                id="machineId"
                name="machineId"
                defaultValue={machineId}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todas las máquinas</option>
                {machines.map((machine) => (
                  <option key={machine.id_maquina} value={machine.id_maquina}>
                    {machine.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="failureStatus" className="text-sm font-medium">
                Estado falla
              </label>
              <select
                id="failureStatus"
                name="failureStatus"
                defaultValue={failureStatus}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {FAILURE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="repairStatus" className="text-sm font-medium">
                Estado reparación
              </label>
              <select
                id="repairStatus"
                name="repairStatus"
                defaultValue={repairStatus}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {REPAIR_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="preventiveStatus"
                className="text-sm font-medium"
              >
                Estado preventivo
              </label>
              <select
                id="preventiveStatus"
                name="preventiveStatus"
                defaultValue={preventiveStatus}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {PREVENTIVE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="searchText" className="text-sm font-medium">
                Buscar
              </label>
              <input
                id="searchText"
                name="searchText"
                type="text"
                defaultValue={searchText}
                placeholder="Máquina, falla, responsable..."
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2 md:col-span-2 xl:col-span-7">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Aplicar filtros
              </button>

              <Link
                href="/dashboard/reports/maintenance"
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Limpiar filtros
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Fallas registradas"
          value={totalFailures}
          description="Fallas encontradas según los filtros aplicados."
        />

        <SummaryCard
          title="Fallas abiertas"
          value={openFailures}
          description="Fallas pendientes o en atención."
        />

        <SummaryCard
          title="Fallas reparadas"
          value={repairedFailures}
          description="Fallas marcadas como reparadas."
        />

        <SummaryCard
          title="Tiempo perdido"
          value={formatHours(totalLostHours)}
          description="Horas perdidas por fallas registradas."
        />

        <SummaryCard
          title="Costo reparación"
          value={formatMoney(totalRepairCost)}
          description="Costo total de reparaciones filtradas."
        />

        <SummaryCard
          title="Mano de obra"
          value={formatMoney(totalLaborCost)}
          description="Costo de mano de obra en reparaciones."
        />

        <SummaryCard
          title="Costo repuestos"
          value={formatMoney(totalSparePartCost)}
          description="Subtotal de repuestos usados."
        />

        <SummaryCard
          title="Máquinas reincidentes"
          value={recurrentMachines}
          description="Máquinas con dos o más fallas en el reporte."
        />

        <SummaryCard
          title="Preventivos pendientes"
          value={pendingPreventives}
          description={`Preventivos vencidos: ${overduePreventives}.`}
        />

        <SummaryCard
          title="Preventivos realizados"
          value={completedPreventives}
          description="Mantenimientos preventivos completados."
        />

        <SummaryCard
          title="Reparaciones"
          value={repairs.length}
          description="Reparaciones encontradas en el periodo."
        />

        <SummaryCard
          title="Máquinas afectadas"
          value={machineRecurrences.length}
          description="Máquinas con al menos una falla en el reporte."
        />
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
              <p className="text-sm text-muted-foreground">
                No hay reincidencias o fallas registradas con los filtros
                aplicados.
              </p>
            ) : (
              <div className="space-y-3">
                {machineRecurrences.slice(0, 8).map((machine) => (
                  <div
                    key={machine.machineId}
                    className="rounded-lg border p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{machine.machineName}</p>
                        <p className="text-xs text-muted-foreground">
                          {machine.machineType} · {machine.machineStatus}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-bold">{machine.failures} fallas</p>
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
              <p className="text-sm text-muted-foreground">
                No se encontraron mantenimientos preventivos con los filtros
                aplicados.
              </p>
            ) : (
              <div className="space-y-3">
                {preventiveMaintenances.slice(0, 8).map((maintenance) => {
                  const isOverdue =
                    maintenance.estado === "pendiente" &&
                    maintenance.fecha_programada < startOfToday;

                  return (
                    <div
                      key={maintenance.id_mantenimiento}
                      className="rounded-lg border p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {maintenance.maquina.nombre}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {maintenance.actividad}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-bold">
                            {formatDate(maintenance.fecha_programada)}
                          </p>
                          <p
                            className={`text-xs ${
                              isOverdue
                                ? "font-medium text-red-600"
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
                        Responsable: {maintenance.responsable ?? "-"} · Usuario:{" "}
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

        <CardContent>
          {failures.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron fallas con los filtros aplicados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Falla</th>
                    <th className="py-2 pr-3 font-medium">Máquina</th>
                    <th className="py-2 pr-3 font-medium">Fecha</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th className="py-2 pr-3 font-medium">Tiempo perdido</th>
                    <th className="py-2 pr-3 font-medium">Descripción</th>
                    <th className="py-2 pr-3 font-medium">Reparaciones</th>
                    <th className="py-2 pr-3 font-medium">Repuestos</th>
                    <th className="py-2 pr-3 font-medium">Responsable</th>
                  </tr>
                </thead>

                <tbody>
                  {failures.map((failure) => {
                    const failureRepairCost = getRepairCost(
                      failure.reparacion,
                    );

                    const spareDetails = failure.reparacion.flatMap((repair) => {
                      return repair.detalle_repuesto_reparacion;
                    });

                    return (
                      <tr key={failure.id_falla} className="border-b align-top">
                        <td className="py-2 pr-3 font-medium">
                          {failure.id_falla}
                        </td>

                        <td className="py-2 pr-3">
                          <div>
                            <p className="font-medium">
                              {failure.maquina.nombre}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {failure.maquina.tipo} ·{" "}
                              {failure.maquina.codigo_interno ?? "Sin código"}
                            </p>
                          </div>
                        </td>

                        <td className="py-2 pr-3">
                          {formatDateTime(failure.fecha_falla)}
                        </td>

                        <td className="py-2 pr-3">
                          {getFailureStatusLabel(failure.estado_atencion)}
                        </td>

                        <td className="py-2 pr-3">
                          {formatHours(failure.tiempo_perdido_horas)}
                        </td>

                        <td className="min-w-64 py-2 pr-3">
                          <p>{failure.descripcion}</p>
                          {failure.impacto_produccion ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Impacto: {failure.impacto_produccion}
                            </p>
                          ) : null}
                        </td>

                        <td className="min-w-72 py-2 pr-3">
                          {failure.reparacion.length === 0 ? (
                            <span className="text-muted-foreground">
                              Sin reparación
                            </span>
                          ) : (
                            <div className="space-y-2">
                              {failure.reparacion.map((repair) => (
                                <div
                                  key={repair.id_reparacion}
                                  className="rounded-md border p-2"
                                >
                                  <p className="font-medium">
                                    {repair.id_reparacion} ·{" "}
                                    {getRepairStatusLabel(
                                      repair.estado_reparacion,
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(repair.fecha_reparacion)} ·{" "}
                                    {repair.tecnico_proveedor ?? "Sin técnico"}{" "}
                                    · {formatMoney(repair.costo_total)}
                                  </p>
                                </div>
                              ))}

                              <p className="text-xs font-medium">
                                Costo total: {formatMoney(failureRepairCost)}
                              </p>
                            </div>
                          )}
                        </td>

                        <td className="min-w-64 py-2 pr-3">
                          {spareDetails.length === 0 ? (
                            <span className="text-muted-foreground">
                              Sin repuestos
                            </span>
                          ) : (
                            <div className="space-y-2">
                              {spareDetails.map((detail) => (
                                <div
                                  key={detail.id_detalle_repuesto}
                                  className="rounded-md border p-2"
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
                        </td>

                        <td className="py-2 pr-3">
                          <div>
                            <p>{failure.responsable_registro ?? "-"}</p>
                            <p className="text-xs text-muted-foreground">
                              {failure.usuario.apellidos},{" "}
                              {failure.usuario.nombres}
                            </p>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
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