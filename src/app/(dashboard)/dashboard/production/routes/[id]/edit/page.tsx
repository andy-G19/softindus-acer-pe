import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { PageHeader } from "@/components/navigation/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { updateFabricationRouteAction } from "@/modules/production/routes/actions";
import Link from "next/link";

type EditFabricationRoutePageProps = {
  params: Promise<{
    id: string;
  }>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

export default async function EditFabricationRoutePage({
  params,
}: EditFabricationRoutePageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const { id } = await params;

  const [route, products] = await Promise.all([
    prisma.ruta_fabricacion.findUnique({
      where: {
        id_ruta: id,
      },
      include: {
        producto: true,
        _count: {
          select: {
            orden_trabajo: true,
          },
        },
      },
    }),
    prisma.producto.findMany({
      where: {
        estado: true,
      },
      orderBy: [
        {
          categoria: "asc",
        },
        {
          nombre_producto: "asc",
        },
      ],
    }),
  ]);

  if (!route) {
    notFound();
  }

  const productItems = products.map((product) => ({
    id: product.id_producto,
    label: product.nombre_producto,
    description: `${product.categoria} - ${product.unidad_medida}`,
  }));

  const productLocked = route._count.orden_trabajo > 0;

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Editar ruta de fabricación"
        description="Actualiza los datos generales de la ruta. Si ya tiene órdenes asociadas, el producto queda protegido para conservar trazabilidad."
        backHref={navigationHrefs.routes}
        backLabel="Volver a rutas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Rutas", href: navigationHrefs.routes },
          { label: "Editar ruta" },
        ])}
      />

      <form
        action={updateFabricationRouteAction}
        className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
      >
        <input type="hidden" name="id_ruta" value={route.id_ruta} />

        {productLocked ? (
          <>
            <input type="hidden" name="id_producto" value={route.id_producto} />

            <div className="space-y-2">
              <Label>Producto</Label>
              <div className="flex h-8 items-center rounded-lg border border-input bg-muted px-2.5 text-sm">
                {route.producto.nombre_producto}
              </div>
              <p className="text-xs text-muted-foreground">
                Esta ruta tiene órdenes asociadas; el producto no se puede
                cambiar desde datos maestros productivos.
              </p>
            </div>
          </>
        ) : (
          <SearchableSelect
            name="id_producto"
            label="Producto"
            placeholder="Buscar producto..."
            items={productItems}
            value={route.id_producto}
            required
            emptyMessage="No hay productos activos disponibles."
          />
        )}

        <div className="space-y-2">
          <Label>Nombre de la ruta *</Label>
          <Input
            name="nombre_ruta"
            required
            maxLength={100}
            defaultValue={route.nombre_ruta}
          />
        </div>

        <div className="space-y-2">
          <Label>Descripción</Label>
          <Textarea
            name="descripcion"
            rows={4}
            maxLength={500}
            defaultValue={route.descripcion ?? ""}
          />
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href="/dashboard/production/routes">Volver a rutas</Link>
          </Button>

          <Button type="submit">Guardar cambios</Button>
        </div>
      </form>
    </main>
  );
}
