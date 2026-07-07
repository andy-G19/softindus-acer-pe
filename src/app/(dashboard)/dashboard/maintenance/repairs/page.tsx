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
import { updateRepairStatusAction } from "@/modules/maintenance/repairs/actions";

type RepairsPageProps = {
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

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatMoney(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
}

function getRepairStatusLabel(status: string) {
  const labels: Record<string, string> = {
    programada: "Programada",
    ejecutada: "Ejecutada",
    observada: "Observada",
    anulada: "Anulada",
  };

  return labels[status] ?? status;
}

function getRepairStatusBadgeVariant(status: string) {
  const variants: Record<
    string,
    "warning" | "secondary" | "destructive" | "success"
  > = {
    programada: "warning",
    ejecutada: "success",
    observada: "secondary",
    anulada: "destructive",
  };

  return variants[status] ?? "secondary";
}

export default async function RepairsPage({ searchParams }: RepairsPageProps) {
  const session = await requireRole([APP_ROLES.ADMIN]);

  const canManageRepairs = session.user.role === APP_ROLES.ADMIN;
  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const machine = parseStringParam(params, "machine");
  const failure = parseStringParam(params, "failure");
  const status = parseStringParam(params, "status");
  const dateRange = buildDateRangeFilter(
    parseDateParam(params, "from"),
    parseDateParam(params, "to"),
  );

  const filters: Prisma.reparacionWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { id_reparacion: { contains: q, mode: "insensitive" } },
        { tecnico_proveedor: { contains: q, mode: "insensitive" } },
        {
          falla_maquina: {
            descripcion: { contains: q, mode: "insensitive" },
          },
        },
        {
          falla_maquina: {
            maquina: {
              nombre: { contains: q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (machine) {
    filters.push({
      falla_maquina: {
        maquina: {
          nombre: { contains: machine, mode: "insensitive" },
        },
      },
    });
  }

  if (failure) {
    filters.push({ id_falla: { contains: failure, mode: "insensitive" } });
  }

  if (status) {
    filters.push({ estado_reparacion: status });
  }

  if (dateRange) {
    filters.push({ fecha_reparacion: dateRange });
  }

  const where: Prisma.reparacionWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const repairs = await prisma.reparacion.findMany({
    where,
    orderBy: {
      fecha_reparacion: "desc",
    },
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
  });

  const scheduledRepairs = repairs.filter(
    (repair) => repair.estado_reparacion === "programada",
  );

  const executedRepairs = repairs.filter(
    (repair) => repair.estado_reparacion === "ejecutada",
  );

  const observedRepairs = repairs.filter(
    (repair) => repair.estado_reparacion === "observada",
  );

  const cancelledRepairs = repairs.filter(
    (repair) => repair.estado_reparacion === "anulada",
  );

  const totalCost = repairs.reduce((total, repair) => {
    return total + toNumber(repair.costo_total);
  }, 0);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Listado de reparaciones"
        description="Consulta las reparaciones registradas por falla, máquina, técnico, mano de obra, repuestos utilizados y costo total."
        backHref={navigationHrefs.maintenance}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Reparaciones" },
        ])}
        actions={
          canManageRepairs ? (
            <Button asChild>
              <Link href="/dashboard/maintenance/repairs/new">
                Registrar reparación
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
              <Input id="q" name="q" defaultValue={q} placeholder="Buscar reparacion, falla o tecnico" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="machine">Máquina</Label>
              <Input id="machine" name="machine" defaultValue={machine} placeholder="Maquina" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="failure">Falla</Label>
              <Input id="failure" name="failure" defaultValue={failure} placeholder="Falla" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <NativeSelect id="status" name="status" defaultValue={status}>
                <option value="">Todos los estados</option>
                <option value="programada">Programada</option>
                <option value="ejecutada">Ejecutada</option>
                <option value="observada">Observada</option>
                <option value="anulada">Anulada</option>
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
                <Link href="/dashboard/maintenance/repairs">Limpiar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Reparaciones" value={repairs.length.toString()} description="Total histórico." tone="info" />
        <KpiCard title="Programadas" value={scheduledRepairs.length.toString()} description={`Observadas: ${observedRepairs.length}`} tone="warning" />
        <KpiCard title="Ejecutadas" value={executedRepairs.length.toString()} description={`Anuladas: ${cancelledRepairs.length}`} tone="success" />
        <KpiCard title="Costo total" value={formatMoney(totalCost)} description="Mano de obra + repuestos." tone="info" />
        <KpiCard title="Promedio" value={formatMoney(repairs.length > 0 ? totalCost / repairs.length : 0)} description="Costo promedio por reparación." tone="info" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reparaciones registradas</CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {repairs.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="Aún no hay reparaciones registradas."
              description="Registra una reparación para calcular mano de obra, repuestos y costo total de mantenimiento."
              action={
                canManageRepairs ? (
                  <Button asChild>
                    <Link href="/dashboard/maintenance/repairs/new">
                      Registrar primera reparación
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
                  <TableHead>Máquina / Falla</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Técnico</TableHead>
                  <TableHead className="text-right">Mano de obra</TableHead>
                  <TableHead className="text-right">Repuestos</TableHead>
                  <TableHead className="text-right">Costo total</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                  {canManageRepairs ? (
                    <TableHead className="text-right">Cambiar estado</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>

              <TableBody>
                {repairs.map((repair) => {
                  const sparePartsTotal =
                    repair.detalle_repuesto_reparacion.reduce(
                      (total, detail) => total + toNumber(detail.subtotal),
                      0,
                    );

                  return (
                    <TableRow key={repair.id_reparacion} className="align-top">
                      <TableCell className="font-mono text-xs">
                        {repair.id_reparacion}
                      </TableCell>

                      <TableCell className="font-medium">
                        {repair.falla_maquina.maquina.nombre}
                        <p className="max-w-md text-xs font-normal text-muted-foreground">
                          Falla: {repair.falla_maquina.descripcion}
                        </p>

                        {repair.detalle_repuesto_reparacion.length > 0 ? (
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {repair.detalle_repuesto_reparacion.map(
                              (detail) => (
                                <p key={detail.id_detalle_repuesto}>
                                  {detail.repuesto.nombre_repuesto} ×{" "}
                                  {detail.cantidad.toString()} ={" "}
                                  {formatMoney(detail.subtotal)}
                                </p>
                              ),
                            )}
                          </div>
                        ) : null}
                      </TableCell>

                      <TableCell>{formatDate(repair.fecha_reparacion)}</TableCell>

                      <TableCell>{repair.tecnico_proveedor ?? "-"}</TableCell>

                      <TableCell className="text-right">
                        {formatMoney(repair.mano_obra)}
                      </TableCell>

                      <TableCell className="text-right">
                        {formatMoney(sparePartsTotal)}
                      </TableCell>

                      <TableCell className="text-right font-medium">
                        {formatMoney(repair.costo_total)}
                      </TableCell>

                      <TableCell className="text-right">
                        <Badge
                          variant={getRepairStatusBadgeVariant(
                            repair.estado_reparacion,
                          )}
                        >
                          {getRepairStatusLabel(repair.estado_reparacion)}
                        </Badge>
                      </TableCell>

                      {canManageRepairs ? (
                        <TableCell className="text-right">
                          {["ejecutada", "anulada"].includes(
                            repair.estado_reparacion,
                          ) ? (
                            <span className="text-xs text-muted-foreground">
                              Sin accion
                            </span>
                          ) : (
                            <form
                              action={updateRepairStatusAction}
                              className="flex justify-end gap-2"
                            >
                              <input
                                type="hidden"
                                name="id_reparacion"
                                value={repair.id_reparacion}
                              />

                              <NativeSelect
                                name="estado_reparacion"
                                defaultValue={repair.estado_reparacion}
                                className="h-8 text-xs"
                              >
                                <option value="programada">Programada</option>
                                <option value="ejecutada">Ejecutada</option>
                                <option value="observada">Observada</option>
                                <option value="anulada">Anulada</option>
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
