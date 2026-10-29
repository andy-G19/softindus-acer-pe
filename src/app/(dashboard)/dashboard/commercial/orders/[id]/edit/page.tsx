import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { commercialNotifications } from "@/modules/commercial/notifications";
import { updateOrderAction } from "@/modules/commercial/orders/actions";
import { buildOrderEditOptions } from "@/modules/commercial/orders/order-edit-options";
import { OrderForm } from "@/modules/commercial/orders/order-form";
import { getOrderEditData } from "@/modules/commercial/orders/queries";

type EditOrderPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDateInput(value: Date | null) {
  if (!value) {
    return "";
  }

  return value.toISOString().split("T")[0];
}

export default async function EditOrderPage({ params, searchParams }: EditOrderPageProps) {
  await requireRole(["ADMIN", "SELLER"]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.orders);
  const { order, clients, products } = await getOrderEditData(id);

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

  // D3 de la 10.4a: el cliente y los productos actuales, aunque esten inactivos.
  const options = buildOrderEditOptions(order, clients, products);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Editar pedido"
        description="Solo se permite editar pedidos sin proforma, comprobante u orden asociada."
        backHref={backHref}
        backLabel="Volver a pedidos"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Pedidos", href: backHref },
          { label: "Editar pedido" },
        ])}
      />

      <OrderForm
        action={updateOrderAction}
        clients={options.clients}
        products={options.products}
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
        successNotification={commercialNotifications["order-updated"]}
        returnTo={backHref}
      />
    </div>
  );
}
