import { notFound } from "next/navigation";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { productionNotifications } from "@/modules/production/notifications";
import { updateFabricationRouteAction } from "@/modules/production/routes/actions";
import { getFabricationRouteEditData } from "@/modules/production/routes/queries";
import { getRouteEditFormProps } from "@/modules/production/routes/route-edit-props";
import { RouteForm } from "@/modules/production/routes/route-form";

type EditRoutePanelProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Edicion de ruta en panel lateral (entrega 10.6a), interceptada desde el listado.
// Misma consulta, formulario, accion y permisos que [id]/edit/page.tsx.
export default async function EditRoutePanel({ params, searchParams }: EditRoutePanelProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};

  const { route, products } = await getFabricationRouteEditData(id);

  if (!route) {
    notFound();
  }

  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.routes);

  return (
    <RouteSheet
      title="Editar ruta de fabricación"
      description={`${route.nombre_ruta} · ${route.id_ruta}`}
      discardTitle="¿Descartar los cambios de la ruta?"
      discardDescription="Se perderán los cambios que hiciste en este panel."
    >
      <RouteForm
        action={updateFabricationRouteAction}
        {...getRouteEditFormProps(route, products)}
        submitLabel="Guardar cambios"
        successNotification={productionNotifications["route-updated"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
