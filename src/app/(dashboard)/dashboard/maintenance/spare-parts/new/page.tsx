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
import { createSparePartAction } from "@/modules/maintenance/spare-parts/actions";
import { SparePartForm } from "@/modules/maintenance/spare-parts/spare-part-form";

export default async function NewSparePartPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const [providers, supplierTypes] = await Promise.all([
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

    prisma.tipo_proveedor_catalogo.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre: "asc",
      },
      select: {
        slug: true,
        nombre: true,
      },
    }),
  ]);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Registrar repuesto"
        description="Registra repuestos disponibles para mantenimiento, proveedor, descripcion y costo unitario."
        backHref={navigationHrefs.spareParts}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Repuestos", href: navigationHrefs.spareParts },
          { label: "Nuevo repuesto" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos principales</CardTitle>
        </CardHeader>
        <CardContent>
          <SparePartForm
            action={createSparePartAction}
            providers={providers.map((provider) => ({
              id: provider.id_proveedor,
              label: provider.razon_social,
            }))}
            supplierTypes={supplierTypes}
            defaultValues={{
              estado: "true",
            }}
            submitLabel="Registrar repuesto"
          />
        </CardContent>
      </Card>
    </main>
  );
}
