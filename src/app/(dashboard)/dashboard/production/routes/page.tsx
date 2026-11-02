import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createReturnToHref,
  dashboardBreadcrumbs,
  navigationHrefs,
  withReturnTo,
} from "@/lib/navigation";
import { productionNotifications } from "@/modules/production/notifications";
import { toggleFabricationRouteStatusAction } from "@/modules/production/routes/actions";
import { getFabricationRouteListData } from "@/modules/production/routes/queries";
import { RouteStatusButton } from "@/modules/production/routes/route-status-button";

type FabricationRoutesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

export default async function FabricationRoutesPage({
  searchParams,
}: FabricationRoutesPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const product = getSearchParam(params, "product");
  const status = getSearchParam(params, "status");
  const returnTo = createReturnToHref(navigationHrefs.routes, params);
  const { routes, products } = await getFabricationRouteListData({
    q,
    product,
    status,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rutas de fabricación"
        description="Consulta las rutas productivas definidas para cada producto del taller."
        backHref={navigationHrefs.production}
        backLabel="Volver a producción"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Rutas" },
        ])}
        actions={
          <Button asChild>
            <Link href={withReturnTo(`${navigationHrefs.routes}/new`, returnTo)}>Nueva ruta</Link>
          </Button>
        }
      />

      <FilterBar
        action={navigationHrefs.routes}
        label="Filtros de rutas"
        clearHref={navigationHrefs.routes}
      >
        <Field id="q" label="Buscar">
          {(control) => (
            <Input {...control} name="q" defaultValue={q} placeholder="Buscar ruta, código o producto..." />
          )}
        </Field>

        <Field id="product" label="Producto">
          {(control) => (
            <NativeSelect {...control} name="product" defaultValue={product}>
              <option value="">Todos los productos</option>
              {products.map((item) => (
                <option key={item.id_producto} value={item.id_producto}>
                  {item.nombre_producto}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field id="status" label="Estado">
          {(control) => (
            <NativeSelect {...control} name="status" defaultValue={status}>
              <option value="">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
            </NativeSelect>
          )}
        </Field>
      </FilterBar>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Ruta</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Etapas</TableHead>
            <TableHead>Órdenes asociadas</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {routes.map((route) => (
            <TableRow key={route.id_ruta}>
              <TableCell className="text-xs">{route.id_ruta}</TableCell>

              <TableCell>
                <div className="font-medium">{route.nombre_ruta}</div>

                {route.descripcion ? (
                  <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                    {route.descripcion}
                  </p>
                ) : null}
              </TableCell>

              <TableCell>{route.producto.nombre_producto}</TableCell>

              <TableCell className="capitalize">
                {route.producto.categoria}
              </TableCell>

              <TableCell>{route._count.etapa_ruta}</TableCell>

              <TableCell>{route._count.orden_trabajo}</TableCell>

              <TableCell>
                <Badge variant={route.estado ? "success" : "outline"}>
                  {route.estado ? "Activa" : "Inactiva"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-2">
                  <Button variant="link" className="h-auto justify-start p-0" asChild>
                    <Link href={withReturnTo(`${navigationHrefs.routes}/${route.id_ruta}/edit`, returnTo)}>
                      Editar
                    </Link>
                  </Button>

                  <Button variant="link" className="h-auto justify-start p-0" asChild>
                    <Link
                      href={`/dashboard/production/routes/${route.id_ruta}/stages`}
                    >
                      Gestionar etapas
                    </Link>
                  </Button>

                  <RouteStatusButton
                    route={route}
                    action={toggleFabricationRouteStatusAction}
                    activatedNotification={productionNotifications["route-activated"]}
                    deactivatedNotification={productionNotifications["route-deactivated"]}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}

          {routes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay rutas de fabricación registradas."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
