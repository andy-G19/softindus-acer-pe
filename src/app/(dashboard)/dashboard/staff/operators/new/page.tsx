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
import { createOperatorAction } from "@/modules/staff/operators/actions";
import { OperatorForm } from "@/modules/staff/operators/operator-form";

export default async function NewOperatorPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const today = new Date().toISOString().split("T")[0];

  return (
    <main className="space-y-6">
      <PageHeader
        title="Registrar operario"
        description="Registra los datos laborales básicos del trabajador, modalidad de pago, tarifa y estado dentro del taller."
        backHref={navigationHrefs.operators}
        backLabel="Volver a operarios"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Personal", href: navigationHrefs.staff },
          { label: "Operarios", href: navigationHrefs.operators },
          { label: "Nuevo operario" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos laborales</CardTitle>
        </CardHeader>
        <CardContent>
          <OperatorForm
            action={createOperatorAction}
            defaultValues={{
              fecha_ingreso: today,
              modalidad_pago: "semanal",
              estado: "activo",
            }}
            submitLabel="Registrar operario"
          />
        </CardContent>
      </Card>
    </main>
  );
}


