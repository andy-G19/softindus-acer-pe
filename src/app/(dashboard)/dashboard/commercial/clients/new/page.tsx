import { redirect } from "next/navigation";

import { auth } from "@/auth";
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
      <div>
        <h1 className="text-2xl font-bold">Nuevo cliente</h1>
        <p className="text-sm text-muted-foreground">
          Registra los datos comerciales del cliente.
        </p>
      </div>

      <ClientForm action={createClientAction} submitLabel="Guardar cliente" />
    </main>
  );
}
