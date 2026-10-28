import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { createOrderAction } from "@/modules/commercial/orders/actions";
import { OrderForm } from "@/modules/commercial/orders/order-form";
import { commercialNotifications } from "@/modules/commercial/notifications";
import { getNewOrderFormOptions } from "@/modules/commercial/orders/queries";

type NewOrderPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewOrderPage({ searchParams }: NewOrderPageProps) {
  await requireRole(["ADMIN", "SELLER"]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.orders);
  const { clients, products } = await getNewOrderFormOptions();

  const clientOptions = clients.map((client) => ({
    id_cliente: client.id_cliente,
    nombre_razon_social: client.nombre_razon_social,
    tipo_cliente: client.tipo_cliente,
  }));

  const productOptions = products.map((product) => ({
    id_producto: product.id_producto,
    nombre_producto: product.nombre_producto,
    categoria: product.categoria,
    unidad_medida: product.unidad_medida,
    precio_referencial: product.precio_referencial?.toString() ?? null,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Nuevo pedido"
        description="Registra un pedido comercial con uno o varios productos asociados al mismo cliente."
        backHref={backHref}
        backLabel="Volver a pedidos"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Pedidos", href: backHref },
          { label: "Nuevo pedido" },
        ])}
      />

      <OrderForm
        action={createOrderAction}
        clients={clientOptions}
        products={productOptions}
        submitLabel="Guardar pedido"
        successNotification={commercialNotifications["order-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
