
import { requireRole } from "@/lib/authz";
import { calculateQuoteTotal } from "@/lib/client-payment-amounts";
import { getQuotableOrders } from "@/modules/commercial/quotes/queries";
import { PageHeader } from "@/components/navigation/page-header";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { commercialNotifications } from "@/modules/commercial/notifications";
import { createQuoteAction } from "@/modules/commercial/quotes/actions";
import { QuoteForm } from "@/modules/commercial/quotes/quote-form";

type NewQuotePageProps = {
  searchParams?: Promise<{
    orderId?: string;
    returnTo?: string | string[];
  }>;
};

export default async function NewQuotePage({ searchParams }: NewQuotePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const defaultOrderId = resolvedSearchParams.orderId;
  // C4 de la 11.3a: vuelve al listado del que vino, con sus filtros.
  const backHref = getSafeReturnTo(resolvedSearchParams.returnTo, navigationHrefs.quotes);

  await requireRole(["ADMIN", "SELLER"]);

  const orders = await getQuotableOrders();

  const orderOptions = orders.map((order) => {
    // C2 de la 11.3a: el mismo total que guardara la proforma, en centimos.
    const total = calculateQuoteTotal(order.detalle_pedido.map((detail) => detail.subtotal));

    return {
      id_pedido: order.id_pedido,
      cliente: order.cliente.nombre_razon_social,
      fecha_pedido: order.fecha_pedido.toISOString(),
      fecha_entrega_estimada:
        order.fecha_entrega_estimada?.toISOString() ?? null,
      monto_total: total,
      productos: order.detalle_pedido.map((detail) => ({
        id_detalle_pedido: detail.id_detalle_pedido,
        producto: detail.producto.nombre_producto,
        cantidad: detail.cantidad.toString(),
        precio_unitario: detail.precio_unitario.toString(),
        subtotal: detail.subtotal.toString(),
      })),
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Nueva proforma"
        description="Genera una proforma digital a partir de un pedido registrado."
        backHref={backHref}
        backLabel="Volver a proformas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Proformas", href: backHref },
          { label: "Nueva proforma" },
        ])}
      />

      <QuoteForm
        action={createQuoteAction}
        orders={orderOptions}
        defaultOrderId={defaultOrderId}
        successNotification={commercialNotifications["quote-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
