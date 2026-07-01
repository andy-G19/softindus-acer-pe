import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createProductAction } from "@/modules/commercial/products/actions";
import { ProductForm } from "@/modules/commercial/products/product-form";

export default async function NewProductPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  const categories = await prisma.categoria_producto.findMany({
    where: {
      estado: true,
    },
    orderBy: {
      nombre: "asc",
    },
    select: {
      nombre: true,
      slug: true,
    },
  });

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Nuevo producto</h1>
        <p className="text-sm text-muted-foreground">
          Registra productos fabricados por el taller usando categorías
          dinámicas.
        </p>
      </div>

      <ProductForm
        action={createProductAction}
        categories={categories}
        submitLabel="Guardar producto"
      />
    </main>
  );
}
