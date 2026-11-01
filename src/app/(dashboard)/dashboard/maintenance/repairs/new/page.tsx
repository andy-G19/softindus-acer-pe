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
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { formatDateTime } from "@/lib/formatters";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { buildSparePartOptionItems, getTodayValue } from "@/modules/maintenance/form-options";
import { maintenanceNotifications } from "@/modules/maintenance/notifications";
import { createRepairAction } from "@/modules/maintenance/repairs/actions";
import { getNewRepairFormOptions } from "@/modules/maintenance/repairs/queries";
import { RepairForm } from "@/modules/maintenance/repairs/repair-form";

type NewRepairPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getFailureStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    en_atencion: "En atencion",
    reparada: "Reparada",
    anulada: "Anulada",
  };

  return labels[status] ?? status;
}

export default async function NewRepairPage({ searchParams }: NewRepairPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.repairs);
  const { failures, spareParts } = await getNewRepairFormOptions();

  const failureItems = failures.map((failure) => ({
    id: failure.id_falla,
    label: failure.maquina.nombre,
    description: `${formatDateTime(failure.fecha_falla)} - ${getFailureStatusLabel(
      failure.estado_atencion,
    )}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrar reparacion"
        description="Registra la atencion realizada a una falla, incluyendo tecnico, mano de obra, repuestos utilizados y costo total calculado."
        backHref={backHref}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Reparaciones", href: backHref },
          { label: "Nueva reparación" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Datos de la reparacion</CardTitle>
          </CardHeader>

          <CardContent>
            {failures.length === 0 ? (
              <EmptyState
                label="No hay fallas pendientes o en atencion."
                description="Primero registra una falla para poder asociarle una reparacion."
                action={
                  <Button asChild>
                    <Link href="/dashboard/maintenance/failures/new">
                      Registrar falla
                    </Link>
                  </Button>
                }
              />
            ) : (
              <RepairForm
                action={createRepairAction}
                failures={failureItems}
                spareParts={buildSparePartOptionItems(spareParts)}
                defaultValues={{ fecha_reparacion: getTodayValue(), estado_reparacion: "programada" }}
                successNotification={maintenanceNotifications["repair-created"]}
                returnTo={backHref}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calculo automatico</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              El costo total se calcula automaticamente sumando la mano de obra
              mas los subtotales de los repuestos usados.
            </p>

            <p>
              Si registras una reparacion como <strong>Ejecutada</strong>, la
              falla pasara a <strong>Reparada</strong> y la maquina volvera a
              estado <strong>Operativa</strong>.
            </p>

            <p>
              Si la reparacion queda programada u observada, la falla pasara a
              <strong> En atencion</strong> y la maquina quedara en{" "}
              <strong>En mantenimiento</strong>.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
