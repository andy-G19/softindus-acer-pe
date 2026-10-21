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
import {
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";
import { getInventoryOutputListData } from "@/modules/inventory/movements/queries";

type OutputsPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

export default async function InventoryOutputsPage({
  searchParams,
}: OutputsPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const material = parseStringParam(params, "material");
  const order = parseStringParam(params, "order");
  const from = parseDateParam(params, "from");
  const to = parseDateParam(params, "to");
  const { page, pageSize, skip, take } = getPaginationParams(params);

  const { movements, totalItems, materials, workOrders } =
    await getInventoryOutputListData(
      { q, material, order, from, to },
      { skip, take },
    );

  const meta = getPaginationMeta({ totalItems, page, pageSize });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salidas de inventario"
        description="Movimientos de salida asociados a producción u otros motivos."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Salidas" },
        ])}
        actions={
          <Button asChild>
            <Link href="/dashboard/inventory/outputs/new">
              Registrar salida
            </Link>
          </Button>
        }
      />

      <FilterBar
        action={navigationHrefs.inventoryOutputs}
        label="Filtros de salidas"
        clearHref={navigationHrefs.inventoryOutputs}
      >
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Buscar salida..." />}
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
        <Field id="order" label="Orden">
          {(control) => (
            <NativeSelect {...control} name="order" defaultValue={order}>
              <option value="">Todas las órdenes</option>
              {workOrders.map((item) => (
                <option key={item.id_orden_trabajo} value={item.id_orden_trabajo}>
                  {item.id_orden_trabajo}
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
            <TableHead>Orden</TableHead>
            <TableHead>Responsable</TableHead>
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
              <TableCell>{movement.id_orden_trabajo ?? "-"}</TableCell>
              <TableCell>{movement.usuario.usuario}</TableCell>
              <TableCell className="text-right">
                {Number(movement.cantidad.toString()).toFixed(2)}
              </TableCell>
              <TableCell className="text-right">
                {Number(movement.stock_resultante.toString()).toFixed(2)}
              </TableCell>
              <TableCell>
                {movement.id_orden_trabajo ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`/dashboard/production/work-orders/${movement.id_orden_trabajo}`}
                    >
                      Ver orden
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
                  label="Todavía no hay salidas registradas."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <PaginationControls
        meta={meta}
        basePath={navigationHrefs.inventoryOutputs}
        searchParams={params}
        itemLabel="salidas"
      />
    </div>
  );
}
