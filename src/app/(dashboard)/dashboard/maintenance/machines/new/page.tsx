import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createMachineAction } from "@/modules/maintenance/machines/actions";
import { MachineForm } from "@/modules/maintenance/machines/machine-form";

export default async function NewMachinePage() {
  await requireRole([APP_ROLES.ADMIN]);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Registrar máquina"
        description="Registra una máquina o equipo crítico del taller para controlar su estado operativo, ubicación y código interno."
        backHref={navigationHrefs.machines}
        backLabel="Volver a máquinas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Máquinas", href: navigationHrefs.machines },
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
          />
        </CardContent>
      </Card>
    </main>
  );
}


