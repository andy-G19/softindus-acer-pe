import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
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
      <section>
        <p className="text-sm font-medium text-slate-500">
          Inventario · Materiales
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Nuevo material</h1>
        <p className="text-slate-600">
          Registra materia prima, consumibles, repuestos, herramientas u otros
          insumos del taller.
        </p>
      </section>

      <MaterialForm
        action={createMaterialAction}
        categories={categories}
        submitLabel="Guardar material"
        mode="create"
      />
    </main>
  );
}
