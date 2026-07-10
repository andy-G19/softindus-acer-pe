import { notFound } from "next/navigation";

import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { updateProductAction } from "@/modules/commercial/products/actions";
import { ProductForm } from "@/modules/commercial/products/product-form";

type EditProductPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  await requireRole(["ADMIN"]);

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
      <PageHeader
        title="Editar producto"
        description="Actualiza los datos comerciales del producto."
        backHref={navigationHrefs.products}
        backLabel="Volver a productos"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Productos", href: navigationHrefs.products },
          { label: "Editar producto" },
        ])}
      />

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
