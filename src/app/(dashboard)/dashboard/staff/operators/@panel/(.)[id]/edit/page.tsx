import { notFound } from "next/navigation";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { staffNotifications } from "@/modules/staff/notifications";
import { updateOperatorAction } from "@/modules/staff/operators/actions";
import { OperatorForm } from "@/modules/staff/operators/operator-form";
import { operatorEditFormValues } from "@/modules/staff/operators/operator-form-values";
import { getOperatorForEdit } from "@/modules/staff/operators/queries";

type EditOperatorPanelProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Edicion de operario en panel lateral (entrega 10.8a), interceptada desde el
// listado. Misma consulta, formulario, accion y permisos que [id]/edit/page.tsx.
export default async function EditOperatorPanel({ params, searchParams }: EditOperatorPanelProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  const operator = await getOperatorForEdit(id);

  if (!operator) {
    notFound();
  }

  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.operators);

  return (
    <RouteSheet
      title="Editar operario"
      description={`${operator.nombres} ${operator.apellidos} · ${operator.id_operario}`}
      discardTitle="¿Descartar los cambios del operario?"
      discardDescription="Se perderán los cambios que hiciste en este panel."
    >
      <OperatorForm
        action={updateOperatorAction}
        defaultValues={operatorEditFormValues(operator)}
        submitLabel="Guardar cambios"
        successNotification={staffNotifications["operator-updated"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
