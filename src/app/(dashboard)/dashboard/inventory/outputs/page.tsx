import Link from "next/link";

import { PageHeader } from "@/components/navigation/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <main className="space-y-6">
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

      <form
        action="/dashboard/inventory/outputs"
        className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 md:grid-cols-5"
      >
        <div className="space-y-2">
          <Label htmlFor="q">Buscar</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Buscar salida..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="material">Material</Label>
          <NativeSelect id="material" name="material" defaultValue={material}>
            <option value="">Todos los materiales</option>
            {materials.map((item) => (
              <option key={item.id_material} value={item.id_material}>
                {item.nombre_material}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="order">Orden</Label>
          <NativeSelect id="order" name="order" defaultValue={order}>
            <option value="">Todas las órdenes</option>
            {workOrders.map((item) => (
              <option key={item.id_orden_trabajo} value={item.id_orden_trabajo}>
                {item.id_orden_trabajo}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="from">Desde</Label>
          <Input
            id="from"
            name="from"
            type="date"
            defaultValue={parseStringParam(params, "from")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">Hasta</Label>
          <Input
            id="to"
            name="to"
            type="date"
            defaultValue={parseStringParam(params, "to")}
          />
        </div>
        <div className="flex items-end gap-2 md:col-span-5">
          <Button type="submit">Filtrar</Button>
          <Button variant="clear" asChild>
            <Link href="/dashboard/inventory/outputs">Limpiar filtros</Link>
          </Button>
        </div>
      </form>

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
    </main>
  );
}
