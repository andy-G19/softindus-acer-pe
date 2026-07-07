import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { createFabricationRouteAction } from "@/modules/production/routes/actions";
import Link from "next/link";

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

export default async function NewFabricationRoutePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const products = await prisma.producto.findMany({
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
  });

  const productItems = products.map((product) => ({
    id: product.id_producto,
    label: product.nombre_producto,
    description: `${product.categoria} - ${product.unidad_medida}`,
  }));

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nueva ruta de fabricación"
        description="Registra una ruta productiva para un producto. Luego agregaremos sus etapas: corte, forjado, soldadura, lijado, pintura u otras."
        backHref={navigationHrefs.routes}
        backLabel="Volver a rutas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Rutas", href: navigationHrefs.routes },
          { label: "Nueva ruta" },
        ])}
      />

      {products.length === 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            No hay productos activos registrados. Primero registra productos
            en el módulo comercial para poder crear rutas de fabricación.
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        action={createFabricationRouteAction}
        className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
      >
        <SearchableSelect
          name="id_producto"
          label="Producto"
          placeholder="Buscar producto..."
          items={productItems}
          required
          disabled={products.length === 0}
          emptyMessage="No hay productos activos disponibles."
        />

        <div className="space-y-2">
          <Label>Nombre de la ruta *</Label>
          <Input
            name="nombre_ruta"
            required
            maxLength={100}
            placeholder="Ej. Ruta estándar para lampa"
          />
        </div>

        <div className="space-y-2">
          <Label>Descripción</Label>
          <Textarea
            name="descripcion"
            rows={4}
            maxLength={500}
            placeholder="Ej. Corte de plancha, formado, soldadura, lijado y pintura."
          />
        </div>

        <Alert variant="info">
          <AlertDescription>
            En esta pantalla solo registramos la ruta general. Las etapas
            ordenadas de la ruta se crean desde la gestión de etapas de cada
            ruta.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between pt-4">
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href="/dashboard/production/routes">Cancelar</Link>
          </Button>

          <Button type="submit" disabled={products.length === 0}>
            Guardar ruta
          </Button>
        </div>
      </form>
    </main>
  );
}
