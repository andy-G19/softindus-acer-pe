import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { staffNotifications } from "@/modules/staff/notifications";
import { createOperatorAction } from "@/modules/staff/operators/actions";
import { OperatorForm } from "@/modules/staff/operators/operator-form";
import { newOperatorFormValues } from "@/modules/staff/operators/operator-form-values";

type NewOperatorPanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de operario en panel lateral (entrega 10.8a), interceptada desde el
// listado. Mismo formulario, accion y permisos que new/page.tsx.
export default async function NewOperatorPanel({ searchParams }: NewOperatorPanelProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.operators);

  return (
    <RouteSheet
      title="Registrar operario"
      description="Registra los datos laborales básicos del trabajador, su modalidad de pago y su tarifa. Nace activo."
      discardTitle="¿Descartar el operario nuevo?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <OperatorForm
        action={createOperatorAction}
        defaultValues={newOperatorFormValues()}
        submitLabel="Registrar operario"
        successNotification={staffNotifications["operator-created"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
