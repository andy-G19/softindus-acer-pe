import { notFound } from "next/navigation";

import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { prisma } from "@/lib/db";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { updateClientAction } from "@/modules/commercial/clients/actions";
import { ClientForm } from "@/modules/commercial/clients/client-form";

type EditClientPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditClientPage({
  params,
  searchParams,
}: EditClientPageProps) {
  const { id } = await params;
  const queryParams = (await searchParams) ?? {};

  await requireRole(["ADMIN", "SELLER"]);

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

  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.clients);

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Editar cliente"
        description="Actualiza los datos comerciales del cliente."
        backHref={backHref}
        backLabel="Volver a clientes"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Clientes", href: backHref },
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
