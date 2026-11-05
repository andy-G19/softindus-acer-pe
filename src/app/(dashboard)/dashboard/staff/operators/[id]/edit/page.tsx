import { notFound } from "next/navigation";

import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/authz";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { staffNotifications } from "@/modules/staff/notifications";
import { updateOperatorAction } from "@/modules/staff/operators/actions";
import { OperatorForm } from "@/modules/staff/operators/operator-form";
import { operatorEditFormValues } from "@/modules/staff/operators/operator-form-values";
import { getOperatorForEdit } from "@/modules/staff/operators/queries";

type EditOperatorPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditOperatorPage({ params, searchParams }: EditOperatorPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  const operator = await getOperatorForEdit(id);

  if (!operator) {
    notFound();
  }

  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.operators);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Editar operario"
        description="Actualiza los datos laborales básicos del operario sin tocar asistencia ni planillas. El estado se cambia desde la lista."
        backHref={backHref}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Personal", href: navigationHrefs.staff },
          { label: "Operarios", href: backHref },
          { label: "Editar operario" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <OperatorForm
        action={updateOperatorAction}
        defaultValues={operatorEditFormValues(operator)}
        submitLabel="Guardar cambios"
        successNotification={staffNotifications["operator-updated"]}
        returnTo={backHref}
      />
    </div>
  );
}
