import { notFound } from "next/navigation";

import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { prisma } from "@/lib/db";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { updateMaterialAction } from "@/modules/inventory/materials/actions";
import { MaterialForm } from "@/modules/inventory/materials/material-form";

type EditMaterialPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

export default async function EditMaterialPage({
  params,
  searchParams,
}: EditMaterialPageProps) {
  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  await requireRole(["ADMIN"]);

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
  const backHref = getSafeReturnTo(
    queryParams.returnTo,
    navigationHrefs.materials,
  );

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Editar material"
        description="Actualiza los datos maestros del material. El stock se mantiene por movimientos de inventario."
        backHref={backHref}
        backLabel="Volver a materiales"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Materiales", href: backHref },
          { label: "Editar material" },
        ])}
      />

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
