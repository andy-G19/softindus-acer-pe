import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { createTechnicalRecipeAction } from "@/modules/production/recipes/actions";

export default async function NewTechnicalRecipePage() {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const products = await prisma.producto.findMany({
    where: {
      estado: true,
    },
    include: {
      receta_tecnica: {
        select: {
          id_receta: true,
          nombre_receta: true,
          estado: true,
        },
      },
    },
    orderBy: [
      {
        categoria: "asc",
      },
      {
        nombre_producto: "asc",
      },
    ],
  });

  const productItems = products.map((product) => ({
    id: product.id_producto,
    label: product.nombre_producto,
    description: `${product.categoria} - ${product.unidad_medida}`,
  }));

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nueva receta técnica"
        description="Registra la receta técnica base de un producto. Luego agregaremos versiones y materiales requeridos."
        backHref={navigationHrefs.recipes}
        backLabel="Volver a recetas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Recetas", href: navigationHrefs.recipes },
          { label: "Nueva receta" },
        ])}
      />

      {products.length === 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            No hay productos activos registrados. Primero registra productos
            en el módulo comercial para poder crear recetas técnicas.
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        action={createTechnicalRecipeAction}
        className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
      >
        <div className="space-y-2">
          <SearchableSelect
            name="id_producto"
            label="Producto"
            placeholder="Buscar producto..."
            items={productItems}
            required
            disabled={products.length === 0}
            emptyMessage="No hay productos activos."
          />

          <p className="text-xs text-muted-foreground">
            Puedes tener más de una receta por producto siempre que el nombre
            de la receta sea diferente.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Nombre de la receta *</Label>
          <Input
            name="nombre_receta"
            required
            maxLength={100}
            placeholder="Ej. Receta técnica estándar para lampa"
          />
        </div>

        <div className="space-y-2">
          <Label>Descripción técnica</Label>
          <Textarea
            name="descripcion"
            rows={5}
            maxLength={700}
            placeholder="Ej. Receta base para fabricar lampas metálicas considerando materiales principales, consumibles y procesos estándar."
          />
        </div>

        <Alert variant="info">
          <AlertDescription>
            En esta pantalla solo registramos la cabecera de la receta
            técnica. Luego agregarás la versión inicial y registrarás los
            materiales, cantidades, unidad de medida, tipo de consumo y merma
            estimada.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between pt-4">
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href="/dashboard/production/recipes">Cancelar</Link>
          </Button>

          <Button type="submit" disabled={products.length === 0}>
            Guardar receta
          </Button>
        </div>
      </form>
    </main>
  );
}
