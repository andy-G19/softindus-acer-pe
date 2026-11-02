import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { productionNotifications } from "@/modules/production/notifications";
import { createFabricationRouteAction } from "@/modules/production/routes/actions";
import { getNewFabricationRouteProducts } from "@/modules/production/routes/queries";
import { RouteForm } from "@/modules/production/routes/route-form";
import { buildRouteProductOptions } from "@/modules/production/routes/route-product-options";

type NewFabricationRoutePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewFabricationRoutePage({ searchParams }: NewFabricationRoutePageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.routes);
  const products = await getNewFabricationRouteProducts();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nueva ruta de fabricación"
        description="Registra una ruta productiva para un producto. Luego agregaremos sus etapas: corte, forjado, soldadura, lijado, pintura u otras."
        backHref={backHref}
        backLabel="Volver a rutas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Rutas", href: backHref },
          { label: "Nueva ruta" },
        ])}
      />

      <RouteForm
        action={createFabricationRouteAction}
        products={buildRouteProductOptions(products)}
        submitLabel="Guardar ruta"
        successNotification={productionNotifications["route-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
