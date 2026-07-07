import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/navigation/page-header";
import { ConfirmDeleteButton } from "@/components/notifications/confirm-delete-button";
import { Badge } from "@/components/ui/badge";
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
import {
  createReturnToHref,
  dashboardBreadcrumbs,
  navigationHrefs,
  withReturnTo,
} from "@/lib/navigation";
import {
  buildDateRangeFilter,
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";
import { annulPurchaseAction } from "@/modules/inventory/purchases/actions";

type PurchasesPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

function formatDate(value: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE").format(new Date(value));
}

export default async function PurchasesPage({ searchParams }: PurchasesPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const supplier = parseStringParam(params, "supplier");
  const material = parseStringParam(params, "material");
  const purchaseStatus = parseStringParam(params, "status");
  const paymentStatus = parseStringParam(params, "payment");
  const returnTo = createReturnToHref(navigationHrefs.purchases, params);
  const dateRange = buildDateRangeFilter(
    parseDateParam(params, "from"),
    parseDateParam(params, "to"),
  );
  const filters: Prisma.compraWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { id_compra: { contains: q, mode: "insensitive" } },
        { numero_comprobante: { contains: q, mode: "insensitive" } },
        {
          proveedor: {
            razon_social: { contains: q, mode: "insensitive" },
          },
        },
      ],
    });
  }

  if (supplier) {
    filters.push({ id_proveedor: supplier });
  }

  if (material) {
    filters.push({
      detalle_compra: {
        some: {
          id_material: material,
        },
      },
    });
  }

  if (purchaseStatus) {
    filters.push({ estado_compra: purchaseStatus });
  }

  if (paymentStatus) {
    filters.push({ estado_pago: paymentStatus });
  }

  if (dateRange) {
    filters.push({ fecha_compra: dateRange });
  }

  const [purchases, suppliers, materials] = await Promise.all([
    prisma.compra.findMany({
      where: filters.length > 0 ? { AND: filters } : {},
      orderBy: {
        fecha_registro: "desc",
      },
      include: {
        proveedor: true,
        pago_proveedor: {
          select: {
            id_pago_proveedor: true,
          },
        },
        movimiento_inventario: {
          select: {
            id_movimiento: true,
          },
        },
      },
    }),
    prisma.proveedor.findMany({
      orderBy: {
        razon_social: "asc",
      },
      select: {
        id_proveedor: true,
        razon_social: true,
      },
    }),
    prisma.material.findMany({
      orderBy: {
        nombre_material: "asc",
      },
      select: {
        id_material: true,
        nombre_material: true,
      },
    }),
  ]);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Compras"
        description="Consulta compras registradas, pagos y entradas generadas."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Compras" },
        ])}
        actions={
          <Button asChild>
            <Link href="/dashboard/inventory/purchases/new">Nueva compra</Link>
          </Button>
        }
      />

      <form
        action="/dashboard/inventory/purchases"
        className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-6"
      >
        <div className="space-y-2">
          <Label htmlFor="q">Buscar</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Buscar compra..." />
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
          <Label htmlFor="status">Estado compra</Label>
          <NativeSelect id="status" name="status" defaultValue={purchaseStatus}>
            <option value="">Estado compra</option>
            <option value="registrada">Registrada</option>
            <option value="confirmada">Confirmada</option>
            <option value="anulada">Anulada</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment">Estado pago</Label>
          <NativeSelect id="payment" name="payment" defaultValue={paymentStatus}>
            <option value="">Estado pago</option>
            <option value="pendiente">Pendiente</option>
            <option value="parcial">Parcial</option>
            <option value="pagado">Pagado</option>
            <option value="anulada">Anulada</option>
          </NativeSelect>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
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
        </div>
        <div className="flex items-end gap-2 md:col-span-6">
          <Button type="submit">Filtrar</Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/inventory/purchases">Limpiar filtros</Link>
          </Button>
        </div>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Comprobante</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Pago</TableHead>
            <TableHead>Estado compra</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchases.map((purchase) => {
            const canAnnul =
              purchase.estado_compra !== "anulada" &&
              purchase.pago_proveedor.length === 0 &&
              purchase.movimiento_inventario.length > 0;

            return (
              <TableRow key={purchase.id_compra}>
                <TableCell className="text-xs">
                  {purchase.id_compra}
                </TableCell>
                <TableCell>{formatDate(purchase.fecha_compra)}</TableCell>
                <TableCell className="font-medium">
                  {purchase.proveedor.razon_social}
                </TableCell>
                <TableCell>
                  {purchase.numero_comprobante
                    ? `${purchase.tipo_comprobante ?? "-"} ${purchase.numero_comprobante}`
                    : "-"}
                </TableCell>
                <TableCell className="font-medium">
                  {formatMoney(purchase.monto_total)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      purchase.estado_pago === "pagado" ? "success" : "secondary"
                    }
                  >
                    {purchase.estado_pago}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      purchase.estado_compra === "anulada"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {purchase.estado_compra}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={withReturnTo(
                          `${navigationHrefs.purchases}/${purchase.id_compra}`,
                          returnTo,
                        )}
                      >
                        Ver detalle
                      </Link>
                    </Button>
                    {canAnnul ? (
                      <form action={annulPurchaseAction}>
                        <input
                          type="hidden"
                          name="id_compra"
                          value={purchase.id_compra}
                        />
                        <ConfirmDeleteButton
                          title="¿Anular compra?"
                          description="Esta acción marcará la compra como anulada. Verifique antes de continuar."
                          confirmText="Confirmar anulación"
                          entityName="compra"
                          className="hover:bg-destructive/20"
                        >
                          Anular
                        </ConfirmDeleteButton>
                      </form>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}

          {purchases.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay compras registradas."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </main>
  );
}
