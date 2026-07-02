import { notFound, redirect } from "next/navigation";

import { OrderForm } from "@/components/commercial/order-form";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { updateOrderAction } from "@/modules/commercial/orders/actions";

type EditOrderPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDateInput(value: Date | null) {
  if (!value) {
    return "";
  }

  return value.toISOString().split("T")[0];
}

export default async function EditOrderPage({ params }: EditOrderPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const { id } = await params;
  const [order, clients, products] = await Promise.all([
    prisma.pedido.findUnique({
      where: {
        id_pedido: id,
      },
      include: {
        proforma: {
          select: {
            id_proforma: true,
          },
        },
        comprobante_venta: {
          select: {
            id_comprobante: true,
          },
        },
        detalle_pedido: {
          include: {
            producto: true,
            orden_trabajo: {
              select: {
                id_orden_trabajo: true,
              },
            },
          },
        },
      },
    }),
    prisma.cliente.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_razon_social: "asc",
      },
      select: {
        id_cliente: true,
        nombre_razon_social: true,
        tipo_cliente: true,
      },
    }),
    prisma.producto.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_producto: "asc",
      },
      select: {
        id_producto: true,
        nombre_producto: true,
        categoria: true,
        unidad_medida: true,
        precio_referencial: true,
      },
    }),
  ]);

  if (!order) {
    notFound();
  }

  const hasWorkOrder = order.detalle_pedido.some(
    (detail) => detail.orden_trabajo.length > 0,
  );

  if (
    order.estado === "cancelado" ||
    order.proforma.length > 0 ||
    order.comprobante_venta.length > 0 ||
    hasWorkOrder
  ) {
    redirect(`/dashboard/commercial/orders/${order.id_pedido}`);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-bold">Editar pedido</h1>
        <p className="text-sm text-muted-foreground">
          Solo se permite editar pedidos sin proforma, comprobante u orden
          asociada.
        </p>
      </section>

      <OrderForm
        action={updateOrderAction}
        clients={clients}
        products={products.map((product) => ({
          id_producto: product.id_producto,
          nombre_producto: product.nombre_producto,
          categoria: product.categoria,
          unidad_medida: product.unidad_medida,
          precio_referencial: product.precio_referencial?.toString() ?? null,
        }))}
        defaultValues={{
          id_pedido: order.id_pedido,
          id_cliente: order.id_cliente,
          fecha_entrega_estimada: formatDateInput(
            order.fecha_entrega_estimada,
          ),
          observaciones: order.observaciones ?? "",
          items: order.detalle_pedido.map((detail) => ({
            id_producto: detail.id_producto,
            cantidad: detail.cantidad.toString(),
            precio_unitario: detail.precio_unitario.toString(),
            observacion_detalle: detail.observaciones ?? "",
          })),
        }}
        submitLabel="Guardar cambios"
      />
    </main>
  );
}
