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
import { updateFailureStatusAction } from "@/modules/maintenance/failures/actions";

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

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatHours(value: unknown) {
  return `${toNumber(value).toFixed(2)} h`;
}

function getFailureStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    en_atencion: "En atención",
    reparada: "Reparada",
    anulada: "Anulada",
  };

  return labels[status] ?? status;
}

function getFailureStatusBadgeVariant(status: string) {
  const variants: Record<
    string,
    "warning" | "secondary" | "destructive" | "success"
  > = {
    pendiente: "warning",
    en_atencion: "secondary",
    reparada: "success",
    anulada: "destructive",
  };

  return variants[status] ?? "secondary";
}

export default async function FailuresPage() {
  const session = await requireRole([
    APP_ROLES.ADMIN,
    APP_ROLES.WORKSHOP_MASTER,
  ]);

  const canManageFailures =
    session.user.role === APP_ROLES.ADMIN ||
    session.user.role === APP_ROLES.WORKSHOP_MASTER;

  const failures = await prisma.falla_maquina.findMany({
    orderBy: {
      fecha_falla: "desc",
    },
    include: {
      maquina: true,
      _count: {
        select: {
          reparacion: true,
        },
      },
    },
  });

  const pendingFailures = failures.filter(
    (failure) => failure.estado_atencion === "pendiente",
  );

  const inAttentionFailures = failures.filter(
    (failure) => failure.estado_atencion === "en_atencion",
  );

  const repairedFailures = failures.filter(
    (failure) => failure.estado_atencion === "reparada",
  );

  const cancelledFailures = failures.filter(
    (failure) => failure.estado_atencion === "anulada",
  );

  const totalLostHours = failures.reduce((total, failure) => {
    return total + toNumber(failure.tiempo_perdido_horas);
  }, 0);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Fallas"
        description="Consulta las fallas registradas por máquina, su estado de atención, tiempo perdido, impacto en producción y trazabilidad de reparaciones asociadas."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Fallas" },
        ])}
        actions={
          canManageFailures ? (
            <Button asChild>
              <Link href={`${navigationHrefs.failures}/new`}>
                Registrar falla
              </Link>
            </Button>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Fallas registradas" value={failures.length.toString()} description="Total histórico de fallas." tone="info" />
        <KpiCard title="Pendientes" value={pendingFailures.length.toString()} description="Aún no atendidas." tone={pendingFailures.length > 0 ? "warning" : "info"} />
        <KpiCard title="En atención" value={inAttentionFailures.length.toString()} description="Requieren seguimiento." tone="info" />
        <KpiCard title="Reparadas" value={repairedFailures.length.toString()} description={`Anuladas: ${cancelledFailures.length}`} tone="success" />
        <KpiCard title="Tiempo perdido" value={formatHours(totalLostHours)} description="Acumulado por fallas." tone="warning" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fallas registradas</CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {failures.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="Aún no hay fallas registradas."
              description="Registra la primera falla para documentar paradas, problemas técnicos y tiempos perdidos."
              action={
                canManageFailures ? (
                  <Button asChild>
                    <Link href="/dashboard/maintenance/failures/new">
                      Registrar primera falla
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
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead className="text-right">Tiempo perdido</TableHead>
                  <TableHead className="text-right">Reparaciones</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                  {canManageFailures ? (
                    <TableHead className="text-right">Cambiar estado</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>

              <TableBody>
                {failures.map((failure) => (
                  <TableRow key={failure.id_falla} className="align-top">
                    <TableCell className="font-mono text-xs">
                      {failure.id_falla}
                    </TableCell>

                    <TableCell className="font-medium">
                      {failure.maquina.nombre}
                      <p className="text-xs font-normal text-muted-foreground">
                        {failure.maquina.codigo_interno ?? "Sin código interno"}
                      </p>
                    </TableCell>

                    <TableCell>{formatDateTime(failure.fecha_falla)}</TableCell>

                    <TableCell>
                      <p className="max-w-md">{failure.descripcion}</p>

                      {failure.impacto_produccion ? (
                        <p className="mt-1 max-w-md text-xs text-muted-foreground">
                          Impacto: {failure.impacto_produccion}
                        </p>
                      ) : null}
                    </TableCell>

                    <TableCell>{failure.responsable_registro ?? "-"}</TableCell>

                    <TableCell className="text-right">
                      {formatHours(failure.tiempo_perdido_horas)}
                    </TableCell>

                    <TableCell className="text-right">
                      {failure._count.reparacion}
                    </TableCell>

                    <TableCell className="text-right">
                      <Badge
                        variant={getFailureStatusBadgeVariant(
                          failure.estado_atencion,
                        )}
                      >
                        {getFailureStatusLabel(failure.estado_atencion)}
                      </Badge>
                    </TableCell>

                    {canManageFailures ? (
                      <TableCell className="text-right">
                        <form
                          action={updateFailureStatusAction}
                          className="flex justify-end gap-2"
                        >
                          <input
                            type="hidden"
                            name="id_falla"
                            value={failure.id_falla}
                          />

                          <NativeSelect
                            name="estado_atencion"
                            defaultValue={failure.estado_atencion}
                            className="h-8 text-xs"
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="en_atencion">En atención</option>
                            <option value="reparada">Reparada</option>
                            <option value="anulada">Anulada</option>
                          </NativeSelect>

                          <Button type="submit" variant="outline" size="sm">
                            Guardar
                          </Button>
                        </form>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

