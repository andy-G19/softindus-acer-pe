import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/navigation/page-header";
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
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import {
  buildDateRangeFilter,
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";

type EntriesPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

function formatDate(value: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE").format(new Date(value));
}

export default async function InventoryEntriesPage({
  searchParams,
}: EntriesPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "WORKSHOP_MASTER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const material = parseStringParam(params, "material");
  const supplier = parseStringParam(params, "supplier");
  const purchase = parseStringParam(params, "purchase");
  const dateRange = buildDateRangeFilter(
    parseDateParam(params, "from"),
    parseDateParam(params, "to"),
  );
  const filters: Prisma.movimiento_inventarioWhereInput[] = [
    { tipo_movimiento: "entrada" },
  ];

  if (q) {
    filters.push({
      OR: [
        { id_compra: { contains: q, mode: "insensitive" } },
        { material: { nombre_material: { contains: q, mode: "insensitive" } } },
        {
          compra: {
            proveedor: {
              razon_social: { contains: q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (material) {
    filters.push({ id_material: material });
  }

  if (supplier) {
    filters.push({ compra: { id_proveedor: supplier } });
  }

  if (purchase) {
    filters.push({ id_compra: purchase });
  }

  if (dateRange) {
    filters.push({ fecha_movimiento: dateRange });
  }

  const [movements, materials, suppliers, purchases] = await Promise.all([
    prisma.movimiento_inventario.findMany({
      where: { AND: filters },
      orderBy: {
        fecha_movimiento: "desc",
      },
      include: {
        material: true,
        compra: {
          include: {
            proveedor: true,
          },
        },
      },
    }),
    prisma.material.findMany({
      orderBy: { nombre_material: "asc" },
      select: { id_material: true, nombre_material: true },
    }),
    prisma.proveedor.findMany({
      orderBy: { razon_social: "asc" },
      select: { id_proveedor: true, razon_social: true },
    }),
    prisma.compra.findMany({
      orderBy: { fecha_compra: "desc" },
      select: { id_compra: true },
    }),
  ]);

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
          <Button variant="outline" asChild>
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
    </main>
  );
}
