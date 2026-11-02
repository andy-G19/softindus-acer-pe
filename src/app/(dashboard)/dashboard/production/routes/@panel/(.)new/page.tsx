import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { productionNotifications } from "@/modules/production/notifications";
import { createFabricationRouteAction } from "@/modules/production/routes/actions";
import { getNewFabricationRouteProducts } from "@/modules/production/routes/queries";
import { RouteForm } from "@/modules/production/routes/route-form";
import { buildRouteProductOptions } from "@/modules/production/routes/route-product-options";

type NewRoutePanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de ruta en panel lateral (entrega 10.6a), interceptada desde el listado.
// Mismo formulario, consulta, accion y permisos que new/page.tsx.
export default async function NewRoutePanel({ searchParams }: NewRoutePanelProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.routes);
  const products = await getNewFabricationRouteProducts();

  return (
    <RouteSheet
      title="Nueva ruta de fabricación"
      description="Registra una ruta productiva para un producto. Luego agregaremos sus etapas: corte, forjado, soldadura, lijado, pintura u otras."
      discardTitle="¿Descartar la ruta nueva?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <RouteForm
        action={createFabricationRouteAction}
        products={buildRouteProductOptions(products)}
        submitLabel="Guardar ruta"
        successNotification={productionNotifications["route-created"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
