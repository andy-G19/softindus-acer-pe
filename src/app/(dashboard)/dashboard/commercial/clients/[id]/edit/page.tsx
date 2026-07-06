import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/navigation/page-header";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs } from "@/lib/navigation";
import { updateClientAction } from "@/modules/commercial/clients/actions";
import { ClientForm } from "@/modules/commercial/clients/client-form";

type EditClientPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditClientPage({ params }: EditClientPageProps) {
  const { id } = await params;

  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const client = await prisma.cliente.findUnique({
    where: {
      id_cliente: id,
    },
    select: {
      id_cliente: true,
      tipo_cliente: true,
      nombre_razon_social: true,
      tipo_documento: true,
      numero_documento: true,
      telefono: true,
      correo: true,
      direccion: true,
      lugar_origen: true,
      observaciones: true,
    },
  });

  if (!client) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Editar cliente"
        description="Actualiza los datos comerciales del cliente."
        backHref="/dashboard/commercial/clients"
        backLabel="Volver a clientes"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: "/dashboard/commercial" },
          { label: "Clientes", href: "/dashboard/commercial/clients" },
          { label: "Editar cliente" },
        ])}
      />

      <ClientForm
        action={updateClientAction}
        submitLabel="Guardar cambios"
        defaultValues={{
          id_cliente: client.id_cliente,
          tipo_cliente: client.tipo_cliente,
          nombre_razon_social: client.nombre_razon_social,
          tipo_documento: client.tipo_documento ?? "",
          numero_documento: client.numero_documento ?? "",
          telefono: client.telefono ?? "",
          correo: client.correo ?? "",
          direccion: client.direccion ?? "",
          lugar_origen: client.lugar_origen ?? "",
          observaciones: client.observaciones ?? "",
        }}
      />
    </main>
  );
}
