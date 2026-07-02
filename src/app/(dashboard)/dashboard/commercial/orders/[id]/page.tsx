import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { StatusBadge } from "@/components/commercial/status-badge";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

type OrderDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
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

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const { id } = await params;
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

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold">Pedido {order.id_pedido}</h1>
          <p className="text-sm text-muted-foreground">
            Detalle comercial del pedido, productos, proformas y comprobantes.
          </p>
        </div>
        <Link
          href="/dashboard/commercial/orders"
          className="rounded-md border px-4 py-2 text-sm font-medium"
        >
          Volver a pedidos
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Cliente</p>
          <p className="mt-1 font-semibold">
            {order.cliente.nombre_razon_social}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Monto estimado</p>
          <p className="mt-1 text-xl font-bold">
            {formatMoney(order.monto_estimado)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Estado</p>
          <div className="mt-1">
            <StatusBadge status={order.estado} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold">Datos del pedido</h2>
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

      <section className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-right">Cantidad</th>
              <th className="px-4 py-3 text-right">Precio unitario</th>
              <th className="px-4 py-3 text-right">Subtotal</th>
              <th className="px-4 py-3 text-left">Orden</th>
            </tr>
          </thead>
          <tbody>
            {order.detalle_pedido.map((detail) => (
              <tr key={detail.id_detalle_pedido} className="border-t">
                <td className="px-4 py-3 font-medium">
                  {detail.producto.nombre_producto}
                </td>
                <td className="px-4 py-3 text-right">
                  {Number(detail.cantidad.toString()).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatMoney(detail.precio_unitario)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatMoney(detail.subtotal)}
                </td>
                <td className="px-4 py-3">
                  {detail.orden_trabajo[0]?.id_orden_trabajo ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">Proformas</h2>
          <div className="mt-3 space-y-2 text-sm">
            {order.proforma.map((quote) => (
              <Link
                key={quote.id_proforma}
                href={`/dashboard/commercial/quotes/${quote.id_proforma}`}
                className="block rounded-md border px-3 py-2 hover:bg-muted"
              >
                {quote.numero_proforma} - {formatMoney(quote.monto_total)}
              </Link>
            ))}
            {order.proforma.length === 0 ? (
              <p className="text-muted-foreground">Sin proformas.</p>
            ) : null}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">Comprobantes</h2>
          <div className="mt-3 space-y-2 text-sm">
            {order.comprobante_venta.map((receipt) => (
              <p key={receipt.id_comprobante} className="rounded-md border px-3 py-2">
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
