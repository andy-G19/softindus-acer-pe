import Link from "next/link";

import { PageHeader } from "@/components/navigation/page-header";
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
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import {
  buildDateRangeFilter,
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";

type SupplierPaymentsPageProps = {
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

export default async function SupplierPaymentsPage({
  searchParams,
}: SupplierPaymentsPageProps) {
  await requireRole(["ADMIN"]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const supplier = parseStringParam(params, "supplier");
  const purchase = parseStringParam(params, "purchase");
  const method = parseStringParam(params, "method");
  const status = parseStringParam(params, "status");
  const dateRange = buildDateRangeFilter(
    parseDateParam(params, "from"),
    parseDateParam(params, "to"),
  );
  const filters: Prisma.pago_proveedorWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { id_compra: { contains: q, mode: "insensitive" } },
        {
          compra: {
            numero_comprobante: { contains: q, mode: "insensitive" },
          },
        },
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

  if (supplier) {
    filters.push({ id_proveedor: supplier });
  }

  if (purchase) {
    filters.push({ id_compra: purchase });
  }

  if (method) {
    filters.push({ metodo_pago: method });
  }

  if (status) {
    filters.push({ estado_pago: status });
  }

  if (dateRange) {
    filters.push({ fecha_pago: dateRange });
  }

  const [payments, suppliers, purchases] = await Promise.all([
    prisma.pago_proveedor.findMany({
      where: filters.length > 0 ? { AND: filters } : {},
      orderBy: {
        fecha_pago: "desc",
      },
      include: {
        compra: {
          include: {
            proveedor: true,
          },
        },
        usuario: true,
      },
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
        title="Pagos a proveedores"
        description="Consulta pagos registrados desde compras."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Pagos a proveedores" },
        ])}
      />

      <form
        action="/dashboard/inventory/supplier-payments"
        className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 md:grid-cols-6"
      >
        <div className="space-y-2">
          <Label htmlFor="q">Buscar</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Buscar pago..." />
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
          <Label htmlFor="method">Método</Label>
          <NativeSelect id="method" name="method" defaultValue={method}>
            <option value="">Método</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="yape">Yape</option>
            <option value="plin">Plin</option>
            <option value="otro">Otro</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <NativeSelect id="status" name="status" defaultValue={status}>
            <option value="">Estado pago</option>
            <option value="pendiente">Pendiente</option>
            <option value="parcial">Parcial</option>
            <option value="pagado">Pagado</option>
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
            <Link href="/dashboard/inventory/supplier-payments">
              Limpiar filtros
            </Link>
          </Button>
        </div>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Compra</TableHead>
            <TableHead>Método</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id_pago_proveedor}>
              <TableCell>{formatDate(payment.fecha_pago)}</TableCell>
              <TableCell>{payment.compra.proveedor.razon_social}</TableCell>
              <TableCell>{payment.id_compra}</TableCell>
              <TableCell>{payment.metodo_pago}</TableCell>
              <TableCell className="text-right">
                {formatMoney(payment.monto_pagado)}
              </TableCell>
              <TableCell className="text-right">
                {formatMoney(payment.saldo_pendiente)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    payment.estado_pago === "pagado" ? "success" : "secondary"
                  }
                >
                  {payment.estado_pago}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={`/dashboard/inventory/purchases/${payment.id_compra}`}
                  >
                    Ver compra
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay pagos a proveedores."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </main>
  );
}
