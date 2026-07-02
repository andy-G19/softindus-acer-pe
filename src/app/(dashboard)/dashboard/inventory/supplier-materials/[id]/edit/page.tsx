import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
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
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Inventario - Proveedor-material - Editar asociacion
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Editar asociacion proveedor-material
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Actualiza el proveedor, material, precio referencial, disponibilidad
            y tiempo de entrega.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge>Solo ADMIN</Badge>
          <Link
            href="/dashboard/inventory/supplier-materials"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al listado
          </Link>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la asociacion</CardTitle>
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
