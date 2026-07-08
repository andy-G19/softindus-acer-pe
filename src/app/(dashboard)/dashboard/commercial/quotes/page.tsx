import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/components/commercial/status-badge";
import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/notifications/confirm-delete-button";
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
import { annulQuoteAction } from "@/modules/commercial/quotes/actions";

type QuotesPageProps = {
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

export default async function QuotesPage({ searchParams }: QuotesPageProps) {
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
  const status = parseStringParam(params, "status");
  const balance = parseStringParam(params, "balance");
  const from = parseDateParam(params, "from");
  const to = parseDateParam(params, "to");
  const dateRange = buildDateRangeFilter(from, to);
  const filters: Prisma.proformaWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          numero_proforma: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          id_pedido: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          pedido: {
            cliente: {
              nombre_razon_social: {
                contains: q,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    });
  }

  if (client) {
    filters.push({
      pedido: {
        id_cliente: client,
      },
    });
  }

  if (order) {
    filters.push({ id_pedido: order });
  }

  if (status) {
    filters.push({ estado: status });
  }

  if (balance === "pending") {
    filters.push({
      saldo: {
        gt: 0,
      },
    });
  }

  if (balance === "paid") {
    filters.push({
      saldo: 0,
    });
  }

  if (dateRange) {
    filters.push({ fecha_emision: dateRange });
  }

  const where: Prisma.proformaWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [quotes, clients, orders] = await Promise.all([
    prisma.proforma.findMany({
      where,
      orderBy: {
        fecha_emision: "desc",
      },
      include: {
        pago_cliente: {
          select: {
            id_pago_cliente: true,
          },
        },
        comprobante_venta: {
          where: {
            estado: "emitido",
          },
          select: {
            id_comprobante: true,
            numero_comprobante: true,
            tipo_comprobante: true,
          },
        },
        pedido: {
          include: {
            cliente: true,
            detalle_pedido: {
              include: {
                producto: true,
              },
            },
          },
        },
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
        title="Proformas"
        description="Lista de proformas digitales generadas desde pedidos registrados."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Proformas" },
        ])}
        actions={
          <Button asChild>
            <Link href="/dashboard/commercial/quotes/new">Nueva proforma</Link>
          </Button>
        }
      />

      <form
        action="/dashboard/commercial/quotes"
        className="grid gap-3 rounded-lg border border-border/80 bg-card p-4 md:grid-cols-6"
      >
        <div className="space-y-2">
          <Label htmlFor="q">Buscar</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Buscar proforma..." />
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
          <Label htmlFor="status">Estado</Label>
          <NativeSelect id="status" name="status" defaultValue={status}>
            <option value="">Todos los estados</option>
            <option value="vigente">Vigente</option>
            <option value="aceptada">Aceptada</option>
            <option value="pagada">Pagada</option>
            <option value="anulada">Anulada</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="balance">Saldo</Label>
          <NativeSelect id="balance" name="balance" defaultValue={balance}>
            <option value="">Todos los saldos</option>
            <option value="pending">Con saldo</option>
            <option value="paid">Sin saldo</option>
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
            <Link href="/dashboard/commercial/quotes">Limpiar filtros</Link>
          </Button>
        </div>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nro. Proforma</TableHead>
            <TableHead>Pedido</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Saldo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Comprobante</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {quotes.map((quote) => {
              const canPay =
                quote.estado !== "pagada" &&
                quote.estado !== "anulada" &&
                Number(quote.saldo.toString()) > 0;
              const canAnnul =
                quote.estado !== "anulada" &&
                quote.pago_cliente.length === 0 &&
                quote.comprobante_venta.length === 0;

              return (
                <TableRow key={quote.id_proforma}>
                  <TableCell className="font-medium">
                    {quote.numero_proforma}
                  </TableCell>
                  <TableCell>{quote.id_pedido}</TableCell>
                  <TableCell>
                    {quote.pedido.cliente.nombre_razon_social}
                  </TableCell>
                  <TableCell>{formatDate(quote.fecha_emision)}</TableCell>
                  <TableCell>{formatMoney(quote.monto_total)}</TableCell>
                  <TableCell>{formatMoney(quote.saldo)}</TableCell>
                  <TableCell>
                    <StatusBadge status={quote.estado} />
                  </TableCell>
                  <TableCell>
                    {quote.comprobante_venta[0] ? (
                      <Badge variant="success">
                        {quote.comprobante_venta[0].tipo_comprobante}{" "}
                        {quote.comprobante_venta[0].numero_comprobante}
                      </Badge>
                    ) : (
                      <StatusBadge status="sin-comprobante" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/dashboard/commercial/quotes/${quote.id_proforma}`}
                        >
                          Ver detalle
                        </Link>
                      </Button>
                      {canPay ? (
                        <Button size="sm" asChild>
                          <Link
                            href={`/dashboard/commercial/quotes/${quote.id_proforma}`}
                          >
                            Registrar pago
                          </Link>
                        </Button>
                      ) : null}
                      {canAnnul ? (
                        <form action={annulQuoteAction}>
                          <input
                            type="hidden"
                            name="id_proforma"
                            value={quote.id_proforma}
                          />
                          <ConfirmDeleteButton
                            title="¿Anular proforma?"
                            description="Esta acción anulará la proforma y no se puede deshacer."
                            confirmText="Confirmar anulación"
                            entityName="proforma"
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

            {quotes.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="p-0">
                  <EmptyState
                    className="border-0"
                    label="Todavía no hay proformas registradas."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
      </Table>
    </main>
  );
}
