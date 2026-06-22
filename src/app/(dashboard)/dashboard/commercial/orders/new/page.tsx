import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { OrderForm } from "@/components/commercial/order-form";

export default async function NewOrderPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

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
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Nuevo pedido</h1>
        <p className="text-sm text-muted-foreground">
          Registra un pedido comercial con uno o varios productos asociados al
          mismo cliente.
        </p>
      </div>

      <OrderForm clients={clientOptions} products={productOptions} />
    </main>
  );
}