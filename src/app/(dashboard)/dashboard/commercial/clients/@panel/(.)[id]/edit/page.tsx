import { notFound } from "next/navigation";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { updateClientAction } from "@/modules/commercial/clients/actions";
import { ClientForm } from "@/modules/commercial/clients/client-form";
import { getClientForEdit } from "@/modules/commercial/clients/queries";
import { commercialNotifications } from "@/modules/commercial/notifications";

type EditClientPanelProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Edicion de cliente en panel lateral (entrega 9), interceptada desde el
// listado. Misma consulta, formulario, accion y permisos que [id]/edit/page.tsx.
export default async function EditClientPanel({ params, searchParams }: EditClientPanelProps) {
  const { id } = await params;
  const queryParams = (await searchParams) ?? {};

  await requireRole(["ADMIN", "SELLER"]);

  const client = await getClientForEdit(id);

  if (!client) {
    notFound();
  }

  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.clients);

  return (
    <RouteSheet
      title="Editar cliente"
      description={`${client.nombre_razon_social} · ${client.id_cliente}`}
      discardTitle="¿Descartar los cambios del cliente?"
      discardDescription="Se perderán los cambios que hiciste en este panel."
    >
      <ClientForm
        action={updateClientAction}
        submitLabel="Guardar cambios"
        successNotification={commercialNotifications["client-updated"]}
        returnTo={returnTo}
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
    </RouteSheet>
  );
}
