import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { createRouteStageAction } from "@/modules/production/stages/actions";

type NewRouteStagePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function NewRouteStagePage({
  params,
}: NewRouteStagePageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id } = await params;

  const route = await prisma.ruta_fabricacion.findUnique({
    where: {
      id_ruta: id,
    },
    include: {
      producto: true,
      etapa_ruta: {
        orderBy: {
          orden_secuencia: "desc",
        },
        take: 1,
      },
    },
  });

  if (!route) {
    notFound();
  }

  const suggestedOrder = (route.etapa_ruta[0]?.orden_secuencia ?? 0) + 1;

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nueva etapa de ruta"
        description={`Ruta: ${route.nombre_ruta} · Producto: ${route.producto.nombre_producto}`}
        backHref={`/dashboard/production/routes/${route.id_ruta}/stages`}
        backLabel="Volver a etapas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Rutas", href: navigationHrefs.routes },
          { label: "Etapas", href: `/dashboard/production/routes/${route.id_ruta}/stages` },
          { label: "Nueva etapa" },
        ])}
      />

      {!route.estado ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta ruta está inactiva. Actívala antes de agregar nuevas etapas.
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        action={createRouteStageAction}
        className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
      >
        <input type="hidden" name="id_ruta" value={route.id_ruta} />

        <div className="space-y-2">
          <Label>Nombre de la etapa *</Label>
          <Input
            name="nombre_etapa"
            required
            maxLength={100}
            placeholder="Ej. Corte de plancha"
            disabled={!route.estado}
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Orden de ejecución *</Label>
            <Input
              name="orden_secuencia"
              type="number"
              min={1}
              max={999}
              required
              defaultValue={suggestedOrder}
              disabled={!route.estado}
            />
          </div>

          <div className="space-y-2">
            <Label>Tiempo estimado en horas</Label>
            <Input
              name="tiempo_estimado_horas"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ej. 1.50"
              disabled={!route.estado}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Descripción técnica</Label>
          <Textarea
            name="descripcion"
            rows={4}
            maxLength={500}
            placeholder="Ej. Se corta la plancha según medida base antes del formado."
            disabled={!route.estado}
          />
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm">
          <input
            type="checkbox"
            name="requiere_maquina"
            disabled={!route.estado}
            className="mt-1"
          />

          <span>
            <span className="block font-medium text-foreground">
              Esta etapa requiere máquina o equipo crítico
            </span>

            <span className="text-muted-foreground">
              Marca esta opción para etapas como corte, prensa, soldadura,
              esmerilado u otros procesos que dependan de maquinaria.
            </span>
          </span>
        </label>

        <Alert variant="info">
          <AlertDescription>
            Usa números consecutivos: 1, 2, 3, 4... Esto permitirá calcular
            correctamente el flujo de producción y mostrar avances ordenados.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between pt-4">
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href={`/dashboard/production/routes/${route.id_ruta}/stages`}>
              Cancelar
            </Link>
          </Button>

          <Button type="submit" disabled={!route.estado}>
            Guardar etapa
          </Button>
        </div>
      </form>
    </main>
  );
}
