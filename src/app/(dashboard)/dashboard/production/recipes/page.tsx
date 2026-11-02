import { CheckCircle2, FlaskConical, XCircle } from "lucide-react";
import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/formatters";
import {
  createReturnToHref,
  dashboardBreadcrumbs,
  navigationHrefs,
  withReturnTo,
} from "@/lib/navigation";
import { productionNotifications } from "@/modules/production/notifications";
import { toggleTechnicalRecipeStatusAction } from "@/modules/production/recipes/actions";
import { getTechnicalRecipeListData } from "@/modules/production/recipes/queries";
import { RecipeStatusButton } from "@/modules/production/recipes/recipe-status-button";

type RecipesPageProps = {
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

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const product = getSearchParam(params, "product");
  const status = getSearchParam(params, "status");
  const returnTo = createReturnToHref(navigationHrefs.recipes, params);
  const { recipes, products } = await getTechnicalRecipeListData({
    q,
    product,
    status,
  });

  const activeRecipes = recipes.filter((recipe) => recipe.estado === "activa");
  const recipesWithCurrentVersion = recipes.filter((recipe) => {
    return recipe.version_receta.length > 0;
  });
  const recipesWithoutCurrentVersion =
    recipes.length - recipesWithCurrentVersion.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recetas técnicas"
        description="Administra recetas por producto, versión vigente e historial de materiales requeridos para producción."
        backHref={navigationHrefs.production}
        backLabel="Volver a producción"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Recetas" },
        ])}
        actions={
          <Button asChild>
            <Link href={withReturnTo(`${navigationHrefs.recipes}/new`, returnTo)}>Nueva receta</Link>
          </Button>
        }
      />

      <FilterBar
        action={navigationHrefs.recipes}
        label="Filtros de recetas"
        clearHref={navigationHrefs.recipes}
      >
        <Field id="q" label="Buscar">
          {(control) => (
            <Input {...control} name="q" defaultValue={q} placeholder="Buscar receta, código o producto..." />
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
              <option value="activa">Activa</option>
              <option value="inactiva">Inactiva</option>
            </NativeSelect>
          )}
        </Field>
      </FilterBar>

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Recetas registradas" value={recipes.length.toString()} description="Total en el sistema." tone="info" icon={FlaskConical} />
        <KpiCard title="Recetas activas" value={activeRecipes.length.toString()} description="Disponibles para uso." tone="success" icon={FlaskConical} />
        <KpiCard title="Con versión vigente" value={recipesWithCurrentVersion.length.toString()} description="Listas para producir." tone="success" icon={CheckCircle2} />
        <KpiCard title="Sin versión vigente" value={recipesWithoutCurrentVersion.toString()} description="Requieren atención." tone="warning" icon={XCircle} />
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Receta</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Versión vigente</TableHead>
            <TableHead>Historial</TableHead>
            <TableHead>Materiales</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {recipes.map((recipe) => {
            const currentVersion = recipe.version_receta[0];

            return (
              <TableRow key={recipe.id_receta}>
                <TableCell className="text-xs">{recipe.id_receta}</TableCell>

                <TableCell>
                  <div className="font-medium">{recipe.nombre_receta}</div>
                  {recipe.descripcion ? (
                    <p className="mt-1 max-w-md text-xs text-muted-foreground">
                      {recipe.descripcion}
                    </p>
                  ) : null}
                </TableCell>

                <TableCell>
                  <div className="font-medium">
                    {recipe.producto.nombre_producto}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {recipe.producto.categoria}
                  </p>
                </TableCell>

                <TableCell>{formatDate(recipe.fecha_creacion, { format: "d mmm yyyy" })}</TableCell>

                <TableCell>
                  {currentVersion ? (
                    <div>
                      <p className="font-medium">
                        {currentVersion.numero_version}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {currentVersion.id_version_receta}
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Sin versión</span>
                  )}
                </TableCell>

                <TableCell>
                  {recipe._count.version_receta} versión(es)
                </TableCell>

                <TableCell>
                  {currentVersion?._count.detalle_receta ?? 0}
                </TableCell>

                <TableCell>
                  <Badge variant={recipe.estado === "activa" ? "success" : "outline"}>
                    {recipe.estado}
                  </Badge>
                </TableCell>

                <TableCell>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="link" className="h-auto p-0" asChild>
                      <Link
                        href={`/dashboard/production/recipes/${recipe.id_receta}/versions`}
                      >
                        Ver historial
                      </Link>
                    </Button>

                    <RecipeStatusButton
                      recipe={recipe}
                      action={toggleTechnicalRecipeStatusAction}
                      activatedNotification={productionNotifications["recipe-activated"]}
                      deactivatedNotification={productionNotifications["recipe-deactivated"]}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}

          {recipes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay recetas técnicas registradas."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
