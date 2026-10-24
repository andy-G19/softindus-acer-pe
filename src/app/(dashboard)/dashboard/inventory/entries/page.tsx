import Link from "next/link";

import { DateRangeFields } from "@/components/forms/date-range-fields";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { PageHeader } from "@/components/navigation/page-header";
import { PaginationControls } from "@/components/pagination-controls";
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
import { requireRole } from "@/lib/authz";
import { formatDate } from "@/lib/formatters";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { getPaginationMeta, getPaginationParams } from "@/lib/pagination";
import { APP_ROLES } from "@/lib/permissions";
import {
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";
import { getInventoryEntryListData } from "@/modules/inventory/movements/queries";

type EntriesPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

export default async function InventoryEntriesPage({
  searchParams,
}: EntriesPageProps) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);
  // El detalle de compra solo admite ADMIN (entrega 10.3c): el maestro de
  // taller ve el codigo de la compra en su columna, sin «Ver compra», que lo
  // llevaba a «acceso denegado». inventory-links.test.ts lo comprueba.
  const canOpenPurchases = session.user.role === APP_ROLES.ADMIN;

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const material = parseStringParam(params, "material");
  const supplier = parseStringParam(params, "supplier");
  const purchase = parseStringParam(params, "purchase");
  const from = parseDateParam(params, "from");
  const to = parseDateParam(params, "to");
  const { page, pageSize, skip, take } = getPaginationParams(params);

  const { movements, totalItems, materials, suppliers, purchases } =
    await getInventoryEntryListData(
      { q, material, supplier, purchase, from, to },
      { skip, take },
    );

  const meta = getPaginationMeta({ totalItems, page, pageSize });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entradas de inventario"
        description="Movimientos de entrada generados por compras u otros registros."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Entradas" },
        ])}
      />

      <FilterBar
        action={navigationHrefs.inventoryEntries}
        label="Filtros de entradas"
        clearHref={navigationHrefs.inventoryEntries}
      >
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Buscar entrada..." />}
        </Field>
        <Field id="material" label="Material">
          {(control) => (
            <NativeSelect {...control} name="material" defaultValue={material}>
              <option value="">Todos los materiales</option>
              {materials.map((item) => (
                <option key={item.id_material} value={item.id_material}>
                  {item.nombre_material}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id="supplier" label="Proveedor">
          {(control) => (
            <NativeSelect {...control} name="supplier" defaultValue={supplier}>
              <option value="">Todos los proveedores</option>
              {suppliers.map((item) => (
                <option key={item.id_proveedor} value={item.id_proveedor}>
                  {item.razon_social}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id="purchase" label="Compra">
          {(control) => (
            <NativeSelect {...control} name="purchase" defaultValue={purchase}>
              <option value="">Todas las compras</option>
              {purchases.map((item) => (
                <option key={item.id_compra} value={item.id_compra}>
                  {item.id_compra}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <DateRangeFields
          id="fecha"
          defaultFrom={parseStringParam(params, "from")}
          defaultTo={parseStringParam(params, "to")}
        />
      </FilterBar>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Material</TableHead>
            <TableHead>Compra</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead className="text-right">Stock resultante</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => (
            <TableRow key={movement.id_movimiento}>
              <TableCell className="text-xs">
                {movement.id_movimiento}
              </TableCell>
              <TableCell>{formatDate(movement.fecha_movimiento)}</TableCell>
              <TableCell>{movement.material.nombre_material}</TableCell>
              <TableCell>{movement.id_compra ?? "-"}</TableCell>
              <TableCell>
                {movement.compra?.proveedor.razon_social ?? "-"}
              </TableCell>
              <TableCell className="text-right">
                {Number(movement.cantidad.toString()).toFixed(2)}
              </TableCell>
              <TableCell className="text-right">
                {Number(movement.stock_resultante.toString()).toFixed(2)}
              </TableCell>
              <TableCell>
                {movement.id_compra && canOpenPurchases ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`/dashboard/inventory/purchases/${movement.id_compra}`}
                    >
                      Ver compra
                    </Link>
                  </Button>
                ) : (
                  "-"
                )}
              </TableCell>
            </TableRow>
          ))}
          {movements.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay entradas registradas."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <PaginationControls
        meta={meta}
        basePath={navigationHrefs.inventoryEntries}
        searchParams={params}
        itemLabel="entradas"
      />
    </div>
  );
}
