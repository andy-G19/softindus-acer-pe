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

type CustomerPaymentsPageProps = {
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

export default async function CustomerPaymentsPage({
  searchParams,
}: CustomerPaymentsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const client = parseStringParam(params, "client");
  const order = parseStringParam(params, "order");
  const method = parseStringParam(params, "method");
  const type = parseStringParam(params, "type");
  const dateRange = buildDateRangeFilter(
    parseDateParam(params, "from"),
    parseDateParam(params, "to"),
  );
  const filters: Prisma.pago_clienteWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { id_pedido: { contains: q, mode: "insensitive" } },
        { id_proforma: { contains: q, mode: "insensitive" } },
        {
          proforma: {
            pedido: {
              cliente: {
                nombre_razon_social: { contains: q, mode: "insensitive" },
              },
            },
          },
        },
      ],
    });
  }

  if (client) {
    filters.push({
      proforma: {
        pedido: {
          id_cliente: client,
        },
      },
    });
  }

  if (order) {
    filters.push({ id_pedido: order });
  }

  if (method) {
    filters.push({ metodo_pago: method });
  }

  if (type) {
    filters.push({ tipo_pago: type });
  }

  if (dateRange) {
    filters.push({ fecha_pago: dateRange });
  }

  const [payments, clients, orders] = await Promise.all([
    prisma.pago_cliente.findMany({
      where: filters.length > 0 ? { AND: filters } : {},
      orderBy: {
        fecha_pago: "desc",
      },
      include: {
        proforma: {
          include: {
            pedido: {
              include: {
                cliente: true,
              },
            },
          },
        },
        usuario: true,
      },
    }),
    prisma.cliente.findMany({
      orderBy: {
        nombre_razon_social: "asc",
      },
      select: {
        id_cliente: true,
        nombre_razon_social: true,
      },
    }),
    prisma.pedido.findMany({
      orderBy: {
        fecha_pedido: "desc",
      },
      select: {
        id_pedido: true,
      },
    }),
  ]);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Pagos de cliente"
        description="Consulta pagos registrados desde proformas."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Pagos de cliente" },
        ])}
      />

      <form
        action="/dashboard/commercial/payments"
        className="grid gap-3 rounded-lg border border-border/80 bg-card p-4 md:grid-cols-6"
      >
        <div className="space-y-2">
          <Label htmlFor="q">Buscar</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Buscar pago..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="client">Cliente</Label>
          <NativeSelect id="client" name="client" defaultValue={client}>
            <option value="">Todos los clientes</option>
            {clients.map((item) => (
              <option key={item.id_cliente} value={item.id_cliente}>
                {item.nombre_razon_social}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="order">Pedido</Label>
          <NativeSelect id="order" name="order" defaultValue={order}>
            <option value="">Todos los pedidos</option>
            {orders.map((item) => (
              <option key={item.id_pedido} value={item.id_pedido}>
                {item.id_pedido}
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
          <Label htmlFor="type">Tipo de pago</Label>
          <NativeSelect id="type" name="type" defaultValue={type}>
            <option value="">Tipo pago</option>
            <option value="adelanto">Adelanto</option>
            <option value="amortizacion">Amortización</option>
            <option value="cancelacion">Cancelación</option>
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
            <Link href="/dashboard/commercial/payments">Limpiar filtros</Link>
          </Button>
        </div>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Pedido</TableHead>
            <TableHead>Proforma</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Método</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id_pago_cliente}>
              <TableCell>{formatDate(payment.fecha_pago)}</TableCell>
              <TableCell>
                {payment.proforma.pedido.cliente.nombre_razon_social}
              </TableCell>
              <TableCell>{payment.id_pedido}</TableCell>
              <TableCell>{payment.id_proforma}</TableCell>
              <TableCell>{payment.tipo_pago}</TableCell>
              <TableCell>{payment.metodo_pago}</TableCell>
              <TableCell className="text-right">
                {formatMoney(payment.monto_pagado)}
              </TableCell>
              <TableCell className="text-right">
                {formatMoney(payment.saldo_actual)}
              </TableCell>
              <TableCell>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={`/dashboard/commercial/quotes/${payment.id_proforma}`}
                  >
                    Ver proforma
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay pagos registrados."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </main>
  );
}
