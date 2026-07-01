import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { updateProductAction } from "@/modules/commercial/products/actions";
import { ProductForm } from "@/modules/commercial/products/product-form";

type EditProductPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  const product = await prisma.producto.findUnique({
    where: {
      id_producto: id,
    },
    select: {
      id_producto: true,
      nombre_producto: true,
      categoria: true,
      descripcion: true,
      unidad_medida: true,
      precio_referencial: true,
    },
  });

  if (!product) {
    notFound();
  }

  const categories = await prisma.categoria_producto.findMany({
    where: {
      OR: [
        {
          estado: true,
        },
        {
          slug: product.categoria,
        },
      ],
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
        <h1 className="text-2xl font-bold">Editar producto</h1>
        <p className="text-sm text-muted-foreground">
          Actualiza los datos comerciales del producto.
        </p>
      </div>

      <ProductForm
        action={updateProductAction}
        categories={categories}
        submitLabel="Guardar cambios"
        defaultValues={{
          id_producto: product.id_producto,
          nombre_producto: product.nombre_producto,
          categoria: product.categoria,
          descripcion: product.descripcion ?? "",
          unidad_medida: product.unidad_medida,
          precio_referencial: product.precio_referencial?.toString() ?? "",
        }}
      />
    </main>
  );
}
