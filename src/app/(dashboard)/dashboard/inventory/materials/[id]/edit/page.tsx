import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { updateMaterialAction } from "@/modules/inventory/materials/actions";
import { MaterialForm } from "@/modules/inventory/materials/material-form";

type EditMaterialPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

export default async function EditMaterialPage({
  params,
}: EditMaterialPageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  const material = await prisma.material.findUnique({
    where: {
      id_material: id,
    },
  });

  if (!material) {
    notFound();
  }

  const categories = await prisma.categoria_material.findMany({
    where: {
      OR: [
        {
          estado: true,
        },
        {
          slug: material.categoria,
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
    <main className="mx-auto max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">
          Inventario · Materiales
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Editar material</h1>
        <p className="text-slate-600">
          Actualiza los datos maestros del material. El stock se mantiene por
          movimientos de inventario.
        </p>
      </section>

      <MaterialForm
        action={updateMaterialAction}
        categories={categories}
        submitLabel="Guardar cambios"
        mode="edit"
        defaultValues={{
          id_material: material.id_material,
          nombre_material: material.nombre_material,
          categoria: material.categoria,
          unidad_medida: material.unidad_medida,
          stock_actual: formatDecimal(material.stock_actual),
          stock_reservado: formatDecimal(material.stock_reservado),
          stock_minimo: formatDecimal(material.stock_minimo),
          costo_unitario_actual: formatDecimal(
            material.costo_unitario_actual,
          ),
        }}
      />
    </main>
  );
}
