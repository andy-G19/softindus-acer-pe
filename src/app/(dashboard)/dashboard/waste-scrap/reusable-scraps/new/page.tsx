import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createReusableScrapAction } from "@/modules/waste-scrap/reusable-scraps/actions";

export default async function NewReusableScrapPage() {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const [materials, workOrders] = await Promise.all([
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
        categoria: true,
        unidad_medida: true,
        stock_actual: true,
      },
    }),

    prisma.orden_trabajo.findMany({
      where: {
        estado: {
          not: "anulada",
        },
      },
      orderBy: {
        fecha_registro: "desc",
      },
      take: 50,
      include: {
        producto: true,
        cliente: true,
      },
    }),
  ]);

  const materialItems = materials.map((material) => ({
    id: material.id_material,
    label: material.nombre_material,
    description: `${material.categoria} - Stock: ${material.stock_actual.toString()} ${material.unidad_medida}`,
  }));

  const workOrderItems = workOrders.map((order) => ({
    id: order.id_orden_trabajo,
    label: `${order.id_orden_trabajo} - ${order.producto.nombre_producto}`,
    description: order.cliente
      ? `${order.estado} - ${order.cliente.nombre_razon_social}`
      : order.estado,
  }));

  return (
    <main className="space-y-6">
      <PageHeader
        title="Registrar retazo reutilizable"
        description="Registra sobrantes aprovechables generados durante el corte o la producción. Estos retazos quedarán disponibles para reutilización futura dentro del taller."
        backHref={navigationHrefs.wasteScrap}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mermas y chatarra", href: navigationHrefs.wasteScrap },
          { label: "Retazos reutilizables", href: navigationHrefs.reusableScraps },
          { label: "Nuevo retazo" },
        ])}
      />

      {materials.length === 0 ? (
        <EmptyState
          label="No hay materiales activos."
          description="Primero registra materiales o insumos en el módulo de inventario."
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Datos del retazo</CardTitle>
        </CardHeader>

        <CardContent>
          <form action={createReusableScrapAction} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <SearchableSelect
                  name="id_material"
                  label="Material de origen"
                  placeholder="Buscar material..."
                  items={materialItems}
                  required
                  disabled={materials.length === 0}
                  emptyMessage="No hay materiales activos disponibles."
                />

                <p className="text-xs text-muted-foreground">
                  El tipo de material del retazo se tomará automáticamente desde
                  la categoría del material seleccionado.
                </p>
              </div>

              <div className="space-y-2">
                <SearchableSelect
                  name="id_orden_trabajo"
                  label="Orden de trabajo relacionada"
                  placeholder="Buscar orden..."
                  items={workOrderItems}
                  emptyMessage="No hay órdenes de trabajo disponibles."
                />

                <p className="text-xs text-muted-foreground">
                  Usa este campo cuando el retazo provenga de una orden
                  productiva identificable.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="medida_aproximada">Medida aproximada</Label>
                <Input
                  id="medida_aproximada"
                  name="medida_aproximada"
                  type="text"
                  placeholder="Ejemplo: 30 cm x 15 cm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ubicacion">Ubicación física</Label>
                <Input
                  id="ubicacion"
                  name="ubicacion"
                  type="text"
                  placeholder="Ejemplo: Estante A, zona de corte"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cantidad">Cantidad *</Label>
                <Input
                  id="cantidad"
                  name="cantidad"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="Ejemplo: 2"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unidad_medida">Unidad de medida *</Label>
                <NativeSelect
                  id="unidad_medida"
                  name="unidad_medida"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecciona una unidad
                  </option>
                  <option value="unidad">Unidad</option>
                  <option value="kg">Kg</option>
                  <option value="metro">Metro</option>
                  <option value="plancha">Plancha</option>
                  <option value="pieza">Pieza</option>
                </NativeSelect>
              </div>
            </div>

            <div className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                Estado inicial del retazo
              </p>
              <p className="mt-1">
                Todo retazo registrado se guardará inicialmente con estado{" "}
                <span className="font-semibold">disponible</span>. En una fase
                posterior podremos marcarlo como reutilizado o descartado.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
              <Button variant="outline" asChild>
                <Link href="/dashboard/waste-scrap">Cancelar</Link>
              </Button>

              <Button type="submit" disabled={materials.length === 0}>
                Guardar retazo
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
