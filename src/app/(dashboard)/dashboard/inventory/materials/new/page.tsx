import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/navigation/page-header";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { createMaterialAction } from "@/modules/inventory/materials/actions";
import { MaterialForm } from "@/modules/inventory/materials/material-form";

export default async function NewMaterialPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  const categories = await prisma.categoria_material.findMany({
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
    <main className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nuevo material"
        description="Registra materia prima, consumibles, repuestos, herramientas u otros insumos del taller."
        backHref={navigationHrefs.materials}
        backLabel="Volver a materiales"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Materiales", href: navigationHrefs.materials },
          { label: "Nuevo material" },
        ])}
      />

      <MaterialForm
        action={createMaterialAction}
        categories={categories}
        submitLabel="Guardar material"
        mode="create"
      />
    </main>
  );
}
