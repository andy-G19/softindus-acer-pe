import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type GenerateProgressActionProps = {
  idOrdenTrabajo: string;
  /** La ruta de la orden; sin ruta no hay nada que generar y el botón queda deshabilitado. */
  routeName: string | null;
  /** Etapas activas de la ruta: un avance por cada una. */
  stageCount: number;
  /** Sin ruta, sin etapas, con avances ya generados o con la orden anulada o finalizada. */
  disabled: boolean;
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Aviso al terminar; la página lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

function describeGeneration(routeName: string | null, stageCount: number) {
  const route = `la ruta «${routeName ?? ""}»`;

  return stageCount === 1
    ? `Se crea 1 avance pendiente, para la única etapa activa de ${route}.`
    : `Se crean ${stageCount} avances pendientes, uno por cada etapa activa de ${route}.`;
}

// Generar los avances de una orden desde su página de avances (C3 de la 11.6c, D80). Confirma con
// el botón normal, no el destructivo: no anula nada, pero crea un avance por cada etapa activa de
// la ruta, y la confirmación dice cuántos y de qué ruta. Un rechazo (ya tiene avances, la orden se
// anuló) queda dentro de la confirmación; la página se repinta con la revalidación de la acción.
export function GenerateProgressAction({
  idOrdenTrabajo,
  routeName,
  stageCount,
  disabled,
  action,
  successNotification,
}: GenerateProgressActionProps) {
  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_orden_trabajo: idOrdenTrabajo }}
      variant="default"
      size="default"
      disabled={disabled}
      successNotification={successNotification}
      confirm={{
        title: `¿Generar los avances de la orden ${idOrdenTrabajo}?`,
        description: describeGeneration(routeName, stageCount),
        confirmText: "Generar",
        variant: "default",
      }}
      pendingText="Generando..."
    >
      Generar avances por etapa
    </ConfirmActionButton>
  );
}
