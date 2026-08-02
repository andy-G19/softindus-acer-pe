import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { updateRouteStageAction } from "@/modules/production/stages/actions";
import { StageForm } from "@/modules/production/stages/stage-form";

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
      etapa_ruta_maquina: {
        select: {
          id_maquina: true,
          tiempo_maquina_minutos_unidad: true,
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

  const assignment = stage.etapa_ruta_maquina[0];

  // La máquina ya asignada se incluye aunque hoy esté dada de baja o inactiva: quitarla
  // del selector haría que editar cualquier otro campo borrara la asignación en silencio.
  const machines = await prisma.maquina.findMany({
    where: {
      OR: [
        {
          estado: {
            notIn: ["dada_de_baja", "inactiva"],
          },
        },
        ...(assignment ? [{ id_maquina: assignment.id_maquina }] : []),
      ],
    },
    orderBy: {
      nombre: "asc",
    },
    select: {
      id_maquina: true,
      nombre: true,
      tipo: true,
      estado: true,
    },
  });

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
            auditados; evita alterar su significado productivo si ya fue usada.
          </AlertDescription>
        </Alert>
      ) : null}

      {stage.tiempo_estimado_horas !== null &&
      stage.tiempo_operario_minutos_unidad === null ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta etapa tiene un tiempo antiguo de{" "}
            {formatDecimalInput(stage.tiempo_estimado_horas)} horas registrado
            para la etapa completa. Ese dato quedó obsoleto: captura los minutos
            por unidad de operario y de máquina.
          </AlertDescription>
        </Alert>
      ) : null}

      <StageForm
        action={updateRouteStageAction}
        routeId={stage.id_ruta}
        machines={machines}
        defaultValues={{
          id_etapa_ruta: stage.id_etapa_ruta,
          nombre_etapa: stage.nombre_etapa,
          orden_secuencia: String(stage.orden_secuencia),
          descripcion: stage.descripcion ?? "",
          tiempo_operario_minutos_unidad: formatDecimalInput(
            stage.tiempo_operario_minutos_unidad,
          ),
          id_maquina: assignment?.id_maquina ?? "",
          tiempo_maquina_minutos_unidad: formatDecimalInput(
            assignment?.tiempo_maquina_minutos_unidad,
          ),
          modo_tiempo: stage.modo_tiempo,
          requiere_maquina: stage.requiere_maquina,
        }}
        submitLabel="Guardar cambios"
      />
    </main>
  );
}
