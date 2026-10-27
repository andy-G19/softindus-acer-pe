import Link from "next/link";

import { requireRole } from "@/lib/authz";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { PageHeader } from "@/components/navigation/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import { RowActions, RowEditLink } from "@/components/table/row-actions";
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
import { formatMoney } from "@/lib/formatters";
import {
  createReturnToHref,
  dashboardBreadcrumbs,
  navigationHrefs,
  withReturnTo,
} from "@/lib/navigation";
import { getPaginationMeta, getPaginationParams } from "@/lib/pagination";
import { commercialNotifications } from "@/modules/commercial/notifications";
import { toggleProductStatusAction } from "@/modules/commercial/products/actions";
import { ProductStatusButton } from "@/modules/commercial/products/product-status-button";
import { getProductListData } from "@/modules/commercial/products/queries";

type ProductsPageProps = {
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

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const session = await requireRole(["ADMIN", "SELLER"]);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const category = getSearchParam(params, "category");
  const unit = getSearchParam(params, "unit");
  const status = getSearchParam(params, "status");
  const returnTo = createReturnToHref(navigationHrefs.products, params);
  const { page, pageSize, skip, take } = getPaginationParams(params);

  const { products, totalItems, categories, units } = await getProductListData(
    { q, category, unit, status },
    { skip, take },
  );

  const meta = getPaginationMeta({ totalItems, page, pageSize });
  const canManageProduct = session.user.role === "ADMIN";
  const categoryLabels = new Map(
    categories.map((item) => [item.slug, item.nombre]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos"
        description="Lista de productos registrados para ventas, pedidos y producción."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Productos" },
        ])}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/commercial/product-categories">
                Categorías
              </Link>
            </Button>

            {canManageProduct ? (
              <Button asChild>
                <Link href={withReturnTo(`${navigationHrefs.products}/new`, returnTo)}>
                  Nuevo producto
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <FilterBar
        action={navigationHrefs.products}
        label="Filtros de productos"
        clearHref={navigationHrefs.products}
      >
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Buscar producto..." />}
        </Field>

        <Field id="category" label="Categoría">
          {(control) => (
            <NativeSelect {...control} name="category" defaultValue={category}>
              <option value="">Todas las categorías</option>
              {categories.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.nombre}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field id="unit" label="Unidad">
          {(control) => (
            <NativeSelect {...control} name="unit" defaultValue={unit}>
              <option value="">Todas las unidades</option>
              {units.map((item) => (
                <option key={item.unidad_medida} value={item.unidad_medida}>
                  {item.unidad_medida}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field id="status" label="Estado">
          {(control) => (
            <NativeSelect {...control} name="status" defaultValue={status}>
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </NativeSelect>
          )}
        </Field>
      </FilterBar>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Unidad</TableHead>
            <TableHead>Precio referencial</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id_producto}>
              <TableCell>{product.id_producto}</TableCell>
              <TableCell className="font-medium">
                {product.nombre_producto}
              </TableCell>
              <TableCell>
                {categoryLabels.get(product.categoria) ?? product.categoria}
              </TableCell>
              <TableCell>{product.unidad_medida}</TableCell>
              <TableCell>
                {formatMoney(product.precio_referencial, { emptyText: "-" })}
              </TableCell>
              <TableCell>
                <Badge variant={product.estado ? "success" : "outline"}>
                  {product.estado ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell>
                {canManageProduct ? (
                  <RowActions>
                    <RowEditLink
                      href={withReturnTo(
                        `${navigationHrefs.products}/${product.id_producto}/edit`,
                        returnTo,
                      )}
                    />

                    <ProductStatusButton
                      product={product}
                      action={toggleProductStatusAction}
                      activatedNotification={commercialNotifications["product-activated"]}
                      deactivatedNotification={commercialNotifications["product-deactivated"]}
                    />
                  </RowActions>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Solo lectura
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}

          {products.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay productos registrados."
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <PaginationControls
        meta={meta}
        basePath="/dashboard/commercial/products"
        searchParams={params}
        itemLabel="productos"
      />
    </div>
  );
}
