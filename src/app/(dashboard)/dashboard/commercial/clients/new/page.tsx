
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { createClientAction } from "@/modules/commercial/clients/actions";
import { ClientForm } from "@/modules/commercial/clients/client-form";
import { commercialNotifications } from "@/modules/commercial/notifications";

type NewClientPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewClientPage({ searchParams }: NewClientPageProps) {
  await requireRole(["ADMIN", "SELLER"]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.clients);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Nuevo cliente"
        description="Registra los datos comerciales del cliente."
        backHref={backHref}
        backLabel="Volver a clientes"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Clientes", href: backHref },
          { label: "Nuevo cliente" },
        ])}
      />

      <ClientForm
        action={createClientAction}
        submitLabel="Guardar cliente"
        successNotification={commercialNotifications["client-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
