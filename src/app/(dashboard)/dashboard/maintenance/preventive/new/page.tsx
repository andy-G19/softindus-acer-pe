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
import { buildMachineOptionItems, getTodayValue } from "@/modules/maintenance/form-options";
import { findMachineOptions } from "@/modules/maintenance/machines/queries";
import { NoMachinesState } from "@/modules/maintenance/no-machines-state";
import { maintenanceNotifications } from "@/modules/maintenance/notifications";
import { createPreventiveMaintenanceAction } from "@/modules/maintenance/preventive/actions";
import { PreventiveForm } from "@/modules/maintenance/preventive/preventive-form";

type NewPreventiveMaintenancePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewPreventiveMaintenancePage({ searchParams }: NewPreventiveMaintenancePageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.preventiveMaintenance);
  const machines = await findMachineOptions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programar mantenimiento preventivo"
        description="Programa actividades preventivas por maquina para anticipar fallas, reducir paradas imprevistas y mantener la continuidad del taller."
        backHref={backHref}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Preventivos", href: backHref },
          { label: "Nuevo preventivo" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Datos del mantenimiento preventivo
            </CardTitle>
          </CardHeader>

          <CardContent>
            {machines.length === 0 ? (
              <NoMachinesState
                description="Primero registra una maquina para poder programar mantenimientos preventivos."
                canRegisterMachine
              />
            ) : (
              <PreventiveForm
                action={createPreventiveMaintenanceAction}
                machines={buildMachineOptionItems(machines)}
                defaultValues={{ fecha_programada: getTodayValue(), estado: "pendiente" }}
                successNotification={maintenanceNotifications["preventive-maintenance-created"]}
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
              Programa mantenimientos preventivos para maquinas criticas como
              prensas, cortadoras, soldadoras, compresoras o dobladoras.
            </p>

            <p>
              Manten el estado como <strong>Pendiente</strong> hasta que se
              realice la actividad. Al marcarlo como{" "}
              <strong>Realizado</strong>, el sistema registrara la fecha real de
              ejecucion.
            </p>

            <p>
              Los preventivos ayudan a reducir fallas inesperadas y costos por
              paradas de produccion.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
