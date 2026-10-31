import {
  Calculator,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Hammer,
} from "lucide-react";
import Link from "next/link";

import { DateRangeFields } from "@/components/forms/date-range-fields";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
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
import { formatDate, formatMoney } from "@/lib/formatters";
import {
  createReturnToHref,
  dashboardBreadcrumbs,
  navigationHrefs,
  withReturnTo,
} from "@/lib/navigation";
import { toNumber } from "@/lib/numbers";
import { APP_ROLES } from "@/lib/permissions";
import {
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";
import { maintenanceNotifications } from "@/modules/maintenance/notifications";
import { updateRepairStatusAction } from "@/modules/maintenance/repairs/actions";
import { getRepairList } from "@/modules/maintenance/repairs/queries";
import { RepairStatusSelect } from "@/modules/maintenance/repairs/repair-status-select";

type RepairsPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

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
  const from = parseDateParam(params, "from");
  const to = parseDateParam(params, "to");
  const returnTo = createReturnToHref(navigationHrefs.repairs, params);
  const newHref = withReturnTo(`${navigationHrefs.repairs}/new`, returnTo);

  const repairs = await getRepairList({
    q,
    machine,
    failure,
    status,
    from,
    to,
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
    <div className="space-y-6">
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
              <Link href={newHref}>
                Registrar reparación
              </Link>
            </Button>
          ) : null
        }
      />

      <FilterBar
        action={navigationHrefs.repairs}
        label="Filtros de reparaciones"
        clearHref={navigationHrefs.repairs}
        clearLabel="Limpiar"
      >
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Buscar reparacion, falla o tecnico" />}
        </Field>

        <Field id="machine" label="Máquina">
          {(control) => <Input {...control} name="machine" defaultValue={machine} placeholder="Maquina" />}
        </Field>

        <Field id="failure" label="Falla">
          {(control) => <Input {...control} name="failure" defaultValue={failure} placeholder="Falla" />}
        </Field>

        <Field id="status" label="Estado">
          {(control) => (
            <NativeSelect {...control} name="status" defaultValue={status}>
              <option value="">Todos los estados</option>
              <option value="programada">Programada</option>
              <option value="ejecutada">Ejecutada</option>
              <option value="observada">Observada</option>
              <option value="anulada">Anulada</option>
            </NativeSelect>
          )}
        </Field>

        <DateRangeFields
          id="fecha"
          defaultFrom={parseStringParam(params, "from")}
          defaultTo={parseStringParam(params, "to")}
        />
      </FilterBar>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Reparaciones" value={repairs.length.toString()} description="Total histórico." tone="info" icon={Hammer} />
        <KpiCard title="Programadas" value={scheduledRepairs.length.toString()} description={`Observadas: ${observedRepairs.length}`} tone="warning" icon={CalendarClock} />
        <KpiCard title="Ejecutadas" value={executedRepairs.length.toString()} description={`Anuladas: ${cancelledRepairs.length}`} tone="success" icon={CheckCircle2} />
        <KpiCard title="Costo total" value={formatMoney(totalCost)} description="Mano de obra + repuestos." tone="info" icon={CircleDollarSign} />
        <KpiCard title="Promedio" value={formatMoney(repairs.length > 0 ? totalCost / repairs.length : 0)} description="Costo promedio por reparación." tone="info" icon={Calculator} />
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
                    <Link href={newHref}>
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

                      <TableCell>{formatDate(repair.fecha_reparacion, { format: "dd/mm/yyyy" })}</TableCell>

                      <TableCell>{repair.tecnico_proveedor ?? "-"}</TableCell>

                      <TableCell className="text-right">
                        {formatMoney(repair.mano_obra ?? 0)}
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
                          <RepairStatusSelect
                            repair={repair}
                            action={updateRepairStatusAction}
                            successNotification={maintenanceNotifications["repair-updated"]}
                          />
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
    </div>
  );
}
