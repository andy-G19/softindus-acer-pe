import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { addCampaignDetailAction } from "@/modules/production/campaigns/actions";

type NewCampaignDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

export default async function NewCampaignDetailPage({
  params,
}: NewCampaignDetailPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const { id } = await params;

  const campaign = await prisma.campania_produccion.findUnique({
    where: {
      id_campania: id,
    },
    include: {
      campania_detalle: {
        select: {
          id_producto: true,
        },
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  const isClosedCampaign = ["finalizada", "anulada"].includes(campaign.estado);
  const existingProductIds = campaign.campania_detalle.map(
    (detail) => detail.id_producto,
  );

  const products = await prisma.producto.findMany({
    where: {
      estado: true,
      id_producto:
        existingProductIds.length > 0
          ? {
              notIn: existingProductIds,
            }
          : undefined,
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

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Agregar producto a campaña"
        description={`Campaña: ${campaign.nombre_campania}`}
        backHref={`/dashboard/production/campaigns/${campaign.id_campania}`}
        backLabel="Volver al detalle"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Campañas", href: navigationHrefs.campaigns },
          { label: "Agregar producto" },
        ])}
      />

      {isClosedCampaign ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta campaña está finalizada o anulada. No se pueden agregar
            nuevos productos.
          </AlertDescription>
        </Alert>
      ) : null}

      {!isClosedCampaign && products.length === 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            No hay productos activos disponibles para agregar, o todos los
            productos activos ya están registrados en esta campaña.
          </AlertDescription>
        </Alert>
      ) : null}

      {!isClosedCampaign ? (
        <form
          action={addCampaignDetailAction}
          className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
        >
          <input type="hidden" name="id_campania" value={campaign.id_campania} />

          <div className="space-y-2">
            <Label>Producto *</Label>
            <NativeSelect
              name="id_producto"
              required
              disabled={products.length === 0}
            >
              <option value="">Seleccione un producto</option>

              {products.map((product) => (
                <option key={product.id_producto} value={product.id_producto}>
                  {product.nombre_producto} · {product.categoria} ·{" "}
                  {product.unidad_medida}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label>Cantidad objetivo *</Label>
            <Input
              name="cantidad_objetivo"
              type="number"
              min="0.01"
              step="0.01"
              required
              disabled={products.length === 0}
              placeholder="Ej. 100"
            />
          </div>

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              name="observaciones"
              rows={4}
              maxLength={500}
              disabled={products.length === 0}
              placeholder="Ej. Priorizar este producto durante la primera semana."
            />
          </div>

          <Alert variant="info">
            <AlertDescription>
              Un producto solo puede registrarse una vez dentro de la misma
              campaña.
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between pt-4">
            <Button variant="link" className="h-auto p-0" asChild>
              <Link href={`/dashboard/production/campaigns/${campaign.id_campania}`}>
                Cancelar
              </Link>
            </Button>

            <Button type="submit" disabled={products.length === 0}>
              Agregar producto
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="link" className="h-auto p-0" asChild>
          <Link href={`/dashboard/production/campaigns/${campaign.id_campania}`}>
            Volver al detalle de campaña
          </Link>
        </Button>
      )}
    </main>
  );
}
