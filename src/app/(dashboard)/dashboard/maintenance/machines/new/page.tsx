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
import { createMachineAction } from "@/modules/maintenance/machines/actions";
import { MachineForm } from "@/modules/maintenance/machines/machine-form";
import { maintenanceNotifications } from "@/modules/maintenance/notifications";

type NewMachinePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewMachinePage({ searchParams }: NewMachinePageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.machines);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrar máquina"
        description="Registra una máquina o equipo crítico del taller para controlar su estado operativo, ubicación y código interno."
        backHref={backHref}
        backLabel="Volver a máquinas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Máquinas", href: backHref },
          { label: "Nueva máquina" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos principales</CardTitle>
        </CardHeader>
        <CardContent>
          <MachineForm
            action={createMachineAction}
            defaultValues={{
              tipo: "prensa",
              estado: "operativa",
            }}
            submitLabel="Registrar maquina"
            successNotification={maintenanceNotifications["machine-created"]}
            returnTo={backHref}
          />
        </CardContent>
      </Card>
    </div>
  );
}


