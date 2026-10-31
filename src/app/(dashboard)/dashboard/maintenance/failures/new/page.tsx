import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createFailureAction } from "@/modules/maintenance/failures/actions";
import { FailureForm } from "@/modules/maintenance/failures/failure-form";
import {
  buildFailureMachineItems,
  getCurrentDateTimeValue,
} from "@/modules/maintenance/failures/failure-form-options";
import { FailureNoMachines } from "@/modules/maintenance/failures/failure-no-machines";
import { findMachineOptions } from "@/modules/maintenance/machines/queries";
import { maintenanceNotifications } from "@/modules/maintenance/notifications";

type NewFailurePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewFailurePage({ searchParams }: NewFailurePageProps) {
  const session = await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.failures);
  const machines = await findMachineOptions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrar falla de maquinaria"
        description="Documenta una falla tecnica de una maquina o equipo critico, registrando fecha, descripcion, responsable, tiempo perdido e impacto en produccion."
        backHref={backHref}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Fallas", href: backHref },
          { label: "Nueva falla" },
        ])}
        actions={<Badge>ADMIN / Maestro de taller</Badge>}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Datos de la falla</CardTitle>
          </CardHeader>

          <CardContent>
            {machines.length === 0 ? (
              <FailureNoMachines canRegisterMachine={session.user.role === APP_ROLES.ADMIN} />
            ) : (
              <FailureForm
                action={createFailureAction}
                machines={buildFailureMachineItems(machines)}
                defaultValues={{ fecha_falla: getCurrentDateTimeValue(), estado_atencion: "pendiente" }}
                successNotification={maintenanceNotifications["failure-created"]}
                returnTo={backHref}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recomendacion</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Registra la falla apenas ocurra para no perder trazabilidad del
              tiempo detenido y del impacto en produccion.
            </p>

            <p>
              Si la falla todavia no fue revisada, usa el estado{" "}
              <strong>Pendiente</strong>. Si ya esta siendo atendida, usa{" "}
              <strong>En atencion</strong>.
            </p>

            <p>
              La reparacion y el costo economico se registraran en la siguiente
              subfase, cuando implementemos reparaciones y repuestos.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
