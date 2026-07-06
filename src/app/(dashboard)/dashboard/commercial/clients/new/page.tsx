import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/navigation/page-header";
import { dashboardBreadcrumbs } from "@/lib/navigation";
import { createClientAction } from "@/modules/commercial/clients/actions";
import { ClientForm } from "@/modules/commercial/clients/client-form";

export default async function NewClientPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Nuevo cliente"
        description="Registra los datos comerciales del cliente."
        backHref="/dashboard/commercial/clients"
        backLabel="Volver a clientes"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: "/dashboard/commercial" },
          { label: "Clientes", href: "/dashboard/commercial/clients" },
          { label: "Nuevo cliente" },
        ])}
      />

      <ClientForm action={createClientAction} submitLabel="Guardar cliente" />
    </main>
  );
}
