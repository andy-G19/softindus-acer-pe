import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { createClientAction } from "@/modules/commercial/clients/actions";
import { ClientForm } from "@/modules/commercial/clients/client-form";
import { commercialNotifications } from "@/modules/commercial/notifications";

type NewClientPanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de cliente en panel lateral (entrega 9), interceptada desde el listado.
// Mismo formulario, misma accion y mismos permisos que new/page.tsx.
export default async function NewClientPanel({ searchParams }: NewClientPanelProps) {
  await requireRole(["ADMIN", "SELLER"]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.clients);

  return (
    <RouteSheet
      title="Nuevo cliente"
      description="Registra los datos comerciales del cliente."
      discardTitle="¿Descartar el cliente nuevo?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <ClientForm
        action={createClientAction}
        submitLabel="Guardar cliente"
        successNotification={commercialNotifications["client-created"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
