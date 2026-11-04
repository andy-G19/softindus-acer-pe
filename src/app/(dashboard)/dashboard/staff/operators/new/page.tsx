import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/authz";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { staffNotifications } from "@/modules/staff/notifications";
import { createOperatorAction } from "@/modules/staff/operators/actions";
import { OperatorForm } from "@/modules/staff/operators/operator-form";
import { newOperatorFormValues } from "@/modules/staff/operators/operator-form-values";

type NewOperatorPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewOperatorPage({ searchParams }: NewOperatorPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.operators);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Registrar operario"
        description="Registra los datos laborales básicos del trabajador, su modalidad de pago y su tarifa. Nace activo."
        backHref={backHref}
        backLabel="Volver a operarios"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Personal", href: navigationHrefs.staff },
          { label: "Operarios", href: backHref },
          { label: "Nuevo operario" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <OperatorForm
        action={createOperatorAction}
        defaultValues={newOperatorFormValues()}
        submitLabel="Registrar operario"
        successNotification={staffNotifications["operator-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
