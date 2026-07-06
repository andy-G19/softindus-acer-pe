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
import { createSupplierMaterialAction } from "@/modules/inventory/supplier-materials/actions";
import { SupplierMaterialForm } from "@/modules/inventory/supplier-materials/supplier-material-form";

export default async function NewSupplierMaterialPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const [suppliers, materials] = await Promise.all([
    prisma.proveedor.findMany({
      where: {
        estado: true,
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
        estado: true,
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
        title="Nueva asociación proveedor-material"
        description="Relaciona proveedores activos con materiales activos para mantener precios referenciales, disponibilidad y tiempos de entrega."
        backHref={navigationHrefs.supplierMaterials}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          {
            label: "Proveedor-material",
            href: navigationHrefs.supplierMaterials,
          },
          { label: "Nueva asociación" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la asociación</CardTitle>
        </CardHeader>
        <CardContent>
          <SupplierMaterialForm
            action={createSupplierMaterialAction}
            suppliers={suppliers.map((supplier) => ({
              id: supplier.id_proveedor,
              label: supplier.razon_social,
            }))}
            materials={materials.map((material) => ({
              id: material.id_material,
              label: `${material.nombre_material} (${material.unidad_medida})`,
            }))}
            submitLabel="Guardar asociación"
          />
        </CardContent>
      </Card>
    </main>
  );
}
