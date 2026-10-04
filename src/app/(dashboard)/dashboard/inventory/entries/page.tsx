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
import { getInventoryEntryListData } from "@/modules/inventory/movements/queries";

type EntriesPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

export default async function InventoryEntriesPage({
  searchParams,
}: EntriesPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

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
    <main className="space-y-6">
      <PageHeader
        title="Entradas de inventario"
        description="Movimientos de entrada generados por compras u otros registros."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Entradas" },
        ])}
      />

      <form
        action="/dashboard/inventory/entries"
        className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 md:grid-cols-6"
      >
        <div className="space-y-2">
          <Label htmlFor="q">Buscar</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Buscar entrada..." />
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
          <Label htmlFor="supplier">Proveedor</Label>
          <NativeSelect id="supplier" name="supplier" defaultValue={supplier}>
            <option value="">Todos los proveedores</option>
            {suppliers.map((item) => (
              <option key={item.id_proveedor} value={item.id_proveedor}>
                {item.razon_social}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchase">Compra</Label>
          <NativeSelect id="purchase" name="purchase" defaultValue={purchase}>
            <option value="">Todas las compras</option>
            {purchases.map((item) => (
              <option key={item.id_compra} value={item.id_compra}>
                {item.id_compra}
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
        <div className="flex items-end gap-2 md:col-span-6">
          <Button type="submit">Filtrar</Button>
          <Button variant="clear" asChild>
            <Link href="/dashboard/inventory/entries">Limpiar filtros</Link>
          </Button>
        </div>
      </form>

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
                {movement.id_compra ? (
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
    </main>
  );
}
