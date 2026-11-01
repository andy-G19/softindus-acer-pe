import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDecimalInput } from "@/modules/production/stages/stage-edit-values";

// Avisos del alta y la edicion de etapas (entrega 10.6a). Viven aparte porque la
// pagina y el panel leen lo mismo y deben mostrar lo mismo; el formulario los
// recibe y los pone dentro de su cuerpo desplazable.

export function NewStageNotices({ routeActive }: { routeActive: boolean }) {
  return (
    <>
      {!routeActive ? (
        <Alert variant="warning">
          <AlertDescription>Esta ruta está inactiva. Actívala antes de agregar nuevas etapas.</AlertDescription>
        </Alert>
      ) : null}

      <Alert variant="info">
        <AlertDescription>
          Usa números consecutivos en el orden de ejecución: 1, 2, 3, 4... Esto permite calcular el flujo de producción
          y mostrar los avances ordenados.
        </AlertDescription>
      </Alert>
    </>
  );
}

type EditStageNoticesProps = {
  stage: {
    tiempo_estimado_horas: unknown;
    tiempo_operario_minutos_unidad: unknown;
    _count: { avance_orden: number; tarea_operario: number };
  };
};

export function EditStageNotices({ stage }: EditStageNoticesProps) {
  return (
    <>
      {stage._count.avance_orden > 0 || stage._count.tarea_operario > 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta etapa ya tiene trazabilidad operativa. Los cambios quedan auditados; evita alterar su significado
            productivo si ya fue usada.
          </AlertDescription>
        </Alert>
      ) : null}

      {stage.tiempo_estimado_horas !== null && stage.tiempo_operario_minutos_unidad === null ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta etapa tiene un tiempo antiguo de {formatDecimalInput(stage.tiempo_estimado_horas)} horas registrado para
            la etapa completa. Ese dato quedó obsoleto: captura los minutos por unidad de operario y de máquina.
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
