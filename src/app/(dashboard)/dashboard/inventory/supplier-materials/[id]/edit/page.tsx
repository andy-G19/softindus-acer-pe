import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { updateSupplierMaterialAction } from "@/modules/inventory/supplier-materials/actions";
import { SupplierMaterialForm } from "@/modules/inventory/supplier-materials/supplier-material-form";

type EditSupplierMaterialPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditSupplierMaterialPage({
  params,
}: EditSupplierMaterialPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const relation = await prisma.proveedor_material.findUnique({
    where: {
      id_proveedor_material: id,
    },
    include: {
      proveedor: true,
      material: true,
    },
  });

  if (!relation) {
    notFound();
  }

  const [suppliers, materials] = await Promise.all([
    prisma.proveedor.findMany({
      where: {
        OR: [
          {
            estado: true,
          },
          {
            id_proveedor: relation.id_proveedor,
          },
        ],
      },
      orderBy: {
        razon_social: "asc",
      },
      select: {
        id_proveedor: true,
        razon_social: true,
      },
    }),
    prisma.material.findMany({
      where: {
        OR: [
          {
            estado: true,
          },
          {
            id_material: relation.id_material,
          },
        ],
      },
      orderBy: {
        nombre_material: "asc",
      },
      select: {
        id_material: true,
        nombre_material: true,
        unidad_medida: true,
      },
    }),
  ]);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Editar asociación proveedor-material"
        description="Actualiza el proveedor, material, precio referencial, disponibilidad y tiempo de entrega."
        backHref={navigationHrefs.supplierMaterials}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          {
            label: "Proveedor-material",
            href: navigationHrefs.supplierMaterials,
          },
          { label: "Editar asociación" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la asociación</CardTitle>
        </CardHeader>
        <CardContent>
          <SupplierMaterialForm
            action={updateSupplierMaterialAction}
            suppliers={suppliers.map((supplier) => ({
              id: supplier.id_proveedor,
              label: supplier.razon_social,
            }))}
            materials={materials.map((material) => ({
              id: material.id_material,
              label: `${material.nombre_material} (${material.unidad_medida})`,
            }))}
            defaultValues={{
              id_proveedor_material: relation.id_proveedor_material,
              id_proveedor: relation.id_proveedor,
              id_material: relation.id_material,
              unidad_medida: relation.unidad_medida,
              precio_referencial:
                relation.precio_referencial?.toString() ?? "",
              tiempo_entrega_dias:
                relation.tiempo_entrega_dias?.toString() ?? "",
              disponibilidad: relation.disponibilidad ?? "",
            }}
            submitLabel="Guardar cambios"
          />
        </CardContent>
      </Card>
    </main>
  );
}
