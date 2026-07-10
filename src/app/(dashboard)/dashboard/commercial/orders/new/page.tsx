import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { OrderForm } from "@/components/commercial/order-form";

export default async function NewOrderPage() {
  await requireRole(["ADMIN", "SELLER"]);

  const clients = await prisma.cliente.findMany({
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
  });

  const products = await prisma.producto.findMany({
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
  });

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
    <main className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Nuevo pedido"
        description="Registra un pedido comercial con uno o varios productos asociados al mismo cliente."
        backHref={navigationHrefs.orders}
        backLabel="Volver a pedidos"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Pedidos", href: navigationHrefs.orders },
          { label: "Nuevo pedido" },
        ])}
      />

      <OrderForm clients={clientOptions} products={productOptions} />
    </main>
  );
}
