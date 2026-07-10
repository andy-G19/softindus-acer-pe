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
import { updateRouteStageAction } from "@/modules/production/stages/actions";
import Link from "next/link";

type EditRouteStagePageProps = {
  params: Promise<{
    id: string;
    stageId: string;
  }>;
};

function formatDecimalInput(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return Number(value.toString()).toString();
}

export default async function EditRouteStagePage({
  params,
}: EditRouteStagePageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id, stageId } = await params;

  const stage = await prisma.etapa_ruta.findFirst({
    where: {
      id_etapa_ruta: stageId,
      id_ruta: id,
    },
    include: {
      ruta_fabricacion: {
        include: {
          producto: true,
        },
      },
      _count: {
        select: {
          avance_orden: true,
          tarea_operario: true,
        },
      },
    },
  });

  if (!stage) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Editar etapa de ruta"
        description={`Ruta: ${stage.ruta_fabricacion.nombre_ruta} · Producto: ${stage.ruta_fabricacion.producto.nombre_producto}`}
        backHref={`/dashboard/production/routes/${stage.id_ruta}/stages`}
        backLabel="Volver a etapas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Rutas", href: navigationHrefs.routes },
          { label: "Etapas", href: `/dashboard/production/routes/${stage.id_ruta}/stages` },
          { label: "Editar etapa" },
        ])}
      />

      {stage._count.avance_orden > 0 || stage._count.tarea_operario > 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta etapa ya tiene trazabilidad operativa. Los cambios quedan
            auditados; evita alterar su significado productivo si ya fue
            usada.
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        action={updateRouteStageAction}
        className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
      >
        <input type="hidden" name="id_ruta" value={stage.id_ruta} />
        <input type="hidden" name="id_etapa_ruta" value={stage.id_etapa_ruta} />

        <div className="space-y-2">
          <Label>Nombre de la etapa *</Label>
          <Input
            name="nombre_etapa"
            required
            maxLength={100}
            defaultValue={stage.nombre_etapa}
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
              defaultValue={stage.orden_secuencia}
            />
          </div>

          <div className="space-y-2">
            <Label>Tiempo estimado en horas</Label>
            <Input
              name="tiempo_estimado_horas"
              type="number"
              min="0"
              step="0.01"
              defaultValue={formatDecimalInput(stage.tiempo_estimado_horas)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Descripción técnica</Label>
          <Textarea
            name="descripcion"
            rows={4}
            maxLength={500}
            defaultValue={stage.descripcion ?? ""}
          />
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm">
          <input
            type="checkbox"
            name="requiere_maquina"
            defaultChecked={stage.requiere_maquina}
            className="mt-1"
          />

          <span>
            <span className="block font-medium text-foreground">
              Esta etapa requiere máquina o equipo crítico
            </span>

            <span className="text-muted-foreground">
              Se usará para identificar posibles cuellos de botella.
            </span>
          </span>
        </label>

        <div className="flex items-center justify-between pt-4">
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href={`/dashboard/production/routes/${stage.id_ruta}/stages`}>
              Volver a etapas
            </Link>
          </Button>

          <Button type="submit">Guardar cambios</Button>
        </div>
      </form>
    </main>
  );
}
