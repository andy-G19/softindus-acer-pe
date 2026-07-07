import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createScrapAction } from "@/modules/waste-scrap/scraps/actions";

export default async function NewScrapPage() {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const materials = await prisma.material.findMany({
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
  });

  const materialItems = materials.map((material) => ({
    id: material.id_material,
    label: material.nombre_material,
    description: `${material.categoria} - Stock: ${material.stock_actual.toString()} ${material.unidad_medida}`,
  }));

  return (
    <main className="space-y-6">
      <PageHeader
        title="Registrar chatarra generada"
        description="Registra sobrantes no reutilizables generados durante el corte, fabricación o limpieza del área productiva. La chatarra quedará acumulada hasta que se registre su venta."
        backHref={navigationHrefs.scraps}
        backLabel="Volver a chatarra"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mermas y chatarra", href: navigationHrefs.wasteScrap },
          { label: "Chatarra", href: navigationHrefs.scraps },
          { label: "Nueva chatarra" },
        ])}
      />

      <Card>
        <CardHeader>
          <CardTitle>Datos de la chatarra</CardTitle>
        </CardHeader>

        <CardContent>
          <form action={createScrapAction} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <SearchableSelect
                  name="id_material"
                  label="Material de origen"
                  placeholder="Buscar material..."
                  items={materialItems}
                  emptyMessage="No hay materiales activos disponibles."
                />

                <p className="text-xs text-muted-foreground">
                  Selecciona el material si se conoce el origen. Si la chatarra
                  está mezclada, puedes dejarlo como no identificado.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo_material">Tipo de material *</Label>
                <Input
                  id="tipo_material"
                  name="tipo_material"
                  type="text"
                  required
                  placeholder="Ejemplo: acero, fierro, plancha, tubo, mixto"
                />
                <p className="text-xs text-muted-foreground">
                  Este campo ayuda a clasificar la chatarra cuando se venda o se
                  consulte el historial.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="peso_kg">Peso en kg</Label>
                <Input
                  id="peso_kg"
                  name="peso_kg"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Ejemplo: 12.50"
                />
                <p className="text-xs text-muted-foreground">
                  Recomendado cuando la chatarra se controla por peso.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cantidad">Cantidad aproximada</Label>
                <Input
                  id="cantidad"
                  name="cantidad"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Ejemplo: 3"
                />
                <p className="text-xs text-muted-foreground">
                  Útil cuando se registra por bolsas, piezas, baldes o grupos.
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  name="observaciones"
                  rows={4}
                  placeholder="Ejemplo: chatarra generada durante corte de planchas para lampas"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                Estado inicial de la chatarra
              </p>
              <p className="mt-1">
                Todo registro de chatarra se guardará inicialmente con estado{" "}
                <span className="font-semibold">acumulada</span>. Cuando se
                registre una venta, el estado cambiará a{" "}
                <span className="font-semibold">vendida</span>.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
              <Button variant="outline" asChild>
                <Link href="/dashboard/waste-scrap">Cancelar</Link>
              </Button>

              <Button type="submit">Guardar chatarra</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

