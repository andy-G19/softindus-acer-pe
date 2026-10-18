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
import { toggleMaterialStatusAction } from "@/modules/inventory/materials/actions";
import { MaterialStatusButton } from "@/modules/inventory/materials/material-status-button";
import { getMaterialListData } from "@/modules/inventory/materials/queries";
import { inventoryNotifications } from "@/modules/inventory/notifications";

type MaterialsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

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

export default async function MaterialsPage({
  searchParams,
}: MaterialsPageProps) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const category = getSearchParam(params, "category");
  const unit = getSearchParam(params, "unit");
  const status = getSearchParam(params, "status");
  const stock = getSearchParam(params, "stock");
  const returnTo = createReturnToHref(navigationHrefs.materials, params);
  const { page, pageSize, skip, take } = getPaginationParams(params);

  const { materials, totalItems, categories, units } = await getMaterialListData(
    { q, category, unit, status, stock },
    { skip, take },
  );
  const meta = getPaginationMeta({ totalItems, page, pageSize });
  const isAdmin = session.user.role === "ADMIN";
  const categoryLabels = new Map(
    categories.map((item) => [item.slug, item.nombre]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materiales e insumos"
        description="Consulta stock actual, stock reservado, stock mínimo y costo vigente."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Materiales" },
        ])}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/inventory/material-categories">
                Categorías
              </Link>
            </Button>

            {isAdmin ? (
              <Button asChild>
                <Link href={withReturnTo(`${navigationHrefs.materials}/new`, returnTo)}>
                  Nuevo material
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <FilterBar
        action={navigationHrefs.materials}
        label="Filtros de materiales"
        clearHref={navigationHrefs.materials}
      >
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Buscar material..." />}
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

        <Field id="stock" label="Stock">
          {(control) => (
            <NativeSelect {...control} name="stock" defaultValue={stock}>
              <option value="">Todo el stock</option>
              <option value="critical">Críticos</option>
              <option value="ok">No críticos</option>
            </NativeSelect>
          )}
        </Field>
      </FilterBar>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Material</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Unidad</TableHead>
            <TableHead>Stock actual</TableHead>
            <TableHead>Reservado</TableHead>
            <TableHead>Disponible</TableHead>
            <TableHead>Stock mínimo</TableHead>
            <TableHead>Costo actual</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {materials.map((material) => {
              const stockActual = Number(material.stock_actual.toString());
              const stockReservado = Number(material.stock_reservado.toString());
              const stockMinimo = Number(material.stock_minimo.toString());
              const stockDisponible = stockActual - stockReservado;
              const isLowStock =
                stockMinimo > 0 && stockDisponible <= stockMinimo;

              return (
                <TableRow key={material.id_material}>
                  <TableCell className="text-xs">
                    {material.id_material}
                  </TableCell>
                  <TableCell className="font-medium">
                    {material.nombre_material}
                  </TableCell>
                  <TableCell>
                    {categoryLabels.get(material.categoria) ??
                      material.categoria}
                  </TableCell>
                  <TableCell>{material.unidad_medida}</TableCell>
                  <TableCell>
                    {formatDecimal(material.stock_actual)}
                  </TableCell>
                  <TableCell>
                    {formatDecimal(material.stock_reservado)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={isLowStock ? "destructive" : "success"}>
                      {stockDisponible.toFixed(2)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDecimal(material.stock_minimo)}
                  </TableCell>
                  <TableCell>
                    {formatMoney(material.costo_unitario_actual)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={material.estado ? "success" : "outline"}>
                      {material.estado ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <RowActions>
                        <RowEditLink
                          href={withReturnTo(
                            `${navigationHrefs.materials}/${material.id_material}/edit`,
                            returnTo,
                          )}
                        />

                        <MaterialStatusButton
                          material={material}
                          action={toggleMaterialStatusAction}
                          activatedNotification={inventoryNotifications["material-activated"]}
                          deactivatedNotification={inventoryNotifications["material-deactivated"]}
                        />
                      </RowActions>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Solo lectura
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}

            {materials.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="p-0">
                  <EmptyState
                    className="border-0"
                    label="Todavía no hay materiales registrados."
                  />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
      </Table>

      <PaginationControls
        meta={meta}
        basePath={navigationHrefs.materials}
        searchParams={params}
        itemLabel="materiales"
      />
    </div>
  );
}
