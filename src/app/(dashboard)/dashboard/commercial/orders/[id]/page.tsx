import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/authz";
import { StatusBadge } from "@/components/commercial/status-badge";
import { PageHeader } from "@/components/navigation/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";

type OrderDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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

export default async function OrderDetailPage({
  params,
  searchParams,
}: OrderDetailPageProps) {
  await requireRole(["ADMIN", "SELLER"]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  const order = await prisma.pedido.findUnique({
    where: {
      id_pedido: id,
    },
    include: {
      cliente: true,
      usuario: true,
      proforma: {
        orderBy: {
          fecha_emision: "desc",
        },
      },
      comprobante_venta: {
        orderBy: {
          fecha_emision: "desc",
        },
      },
      detalle_pedido: {
        include: {
          producto: true,
          orden_trabajo: {
            select: {
              id_orden_trabajo: true,
              estado: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.orders);

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Detalle de pedido"
        description="Consulta la información comercial, productos y estado del pedido."
        backHref={backHref}
        backLabel="Volver a pedidos"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Pedidos", href: backHref },
          { label: order.id_pedido },
        ])}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard
          title="Cliente"
          value={order.cliente.nombre_razon_social}
          description="Cliente asociado al pedido."
        />
        <KpiCard
          title="Monto estimado"
          value={formatMoney(order.monto_estimado)}
          description="Suma referencial del detalle del pedido."
          tone="warning"
        />
        <div className="rounded-xl border border-border/80 bg-card p-5">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
            Estado
          </p>
          <div className="mt-2">
            <StatusBadge status={order.estado} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-4">
        <h2 className="font-heading font-semibold text-foreground">
          Datos del pedido
        </h2>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
          <p>
            <span className="font-medium">Fecha pedido:</span>{" "}
            {formatDate(order.fecha_pedido)}
          </p>
          <p>
            <span className="font-medium">Entrega estimada:</span>{" "}
            {formatDate(order.fecha_entrega_estimada)}
          </p>
          <p>
            <span className="font-medium">Registrado por:</span>{" "}
            {order.usuario.usuario}
          </p>
        </div>
        {order.observaciones ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {order.observaciones}
          </p>
        ) : null}
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead className="text-right">Precio unitario</TableHead>
            <TableHead className="text-right">Subtotal</TableHead>
            <TableHead>Orden</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.detalle_pedido.map((detail) => (
            <TableRow key={detail.id_detalle_pedido}>
              <TableCell className="font-medium">
                {detail.producto.nombre_producto}
              </TableCell>
              <TableCell className="text-right">
                {Number(detail.cantidad.toString()).toFixed(2)}
              </TableCell>
              <TableCell className="text-right">
                {formatMoney(detail.precio_unitario)}
              </TableCell>
              <TableCell className="text-right">
                {formatMoney(detail.subtotal)}
              </TableCell>
              <TableCell>
                {detail.orden_trabajo[0]?.id_orden_trabajo ?? "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <h2 className="font-heading font-semibold text-foreground">
            Proformas
          </h2>
          <div className="mt-3 space-y-2 text-sm">
            {order.proforma.map((quote) => (
              <Link
                key={quote.id_proforma}
                href={`/dashboard/commercial/quotes/${quote.id_proforma}`}
                className="block rounded-md border border-border/80 px-3 py-2 transition hover:bg-secondary"
              >
                {quote.numero_proforma} - {formatMoney(quote.monto_total)}
              </Link>
            ))}
            {order.proforma.length === 0 ? (
              <p className="text-muted-foreground">Sin proformas.</p>
            ) : null}
          </div>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <h2 className="font-heading font-semibold text-foreground">
            Comprobantes
          </h2>
          <div className="mt-3 space-y-2 text-sm">
            {order.comprobante_venta.map((receipt) => (
              <p
                key={receipt.id_comprobante}
                className="rounded-md border border-border/80 px-3 py-2"
              >
                {receipt.tipo_comprobante} {receipt.numero_comprobante} -{" "}
                {formatMoney(receipt.monto_total)}
              </p>
            ))}
            {order.comprobante_venta.length === 0 ? (
              <p className="text-muted-foreground">Sin comprobantes.</p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

