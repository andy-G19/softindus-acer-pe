import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { QuoteForm } from "@/components/commercial/quote-form";
import { PageHeader } from "@/components/navigation/page-header";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";

type NewQuotePageProps = {
  searchParams?: Promise<{
    orderId?: string;
  }>;
};

export default async function NewQuotePage({ searchParams }: NewQuotePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const defaultOrderId = resolvedSearchParams.orderId;

  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
}

  const orders = await prisma.pedido.findMany({
    where: {
      estado: {
        in: ["registrado", "aprobado"],
      },
      detalle_pedido: {
        some: {},
      },
      proforma: {
        none: {
          estado: {
            in: ["vigente", "aceptada", "pagada"],
          },
        },
      },
    },
    orderBy: {
      fecha_pedido: "desc",
    },
    include: {
      cliente: true,
      detalle_pedido: {
        include: {
          producto: true,
        },
      },
    },
  });

  const orderOptions = orders.map((order) => {
    const total = order.detalle_pedido.reduce((sum, detail) => {
      return sum + Number(detail.subtotal.toString());
    }, 0);

    return {
      id_pedido: order.id_pedido,
      cliente: order.cliente.nombre_razon_social,
      fecha_pedido: order.fecha_pedido.toISOString(),
      fecha_entrega_estimada:
        order.fecha_entrega_estimada?.toISOString() ?? null,
      monto_total: total.toString(),
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
    <main className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Nueva proforma"
        description="Genera una proforma digital a partir de un pedido registrado."
        backHref={navigationHrefs.quotes}
        backLabel="Volver a proformas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Proformas", href: navigationHrefs.quotes },
          { label: "Nueva proforma" },
        ])}
      />

      <QuoteForm orders={orderOptions} defaultOrderId={defaultOrderId}/>
    </main>
  );
}
