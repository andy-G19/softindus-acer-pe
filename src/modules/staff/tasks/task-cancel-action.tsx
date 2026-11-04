import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type TaskCancelActionProps = {
  task: {
    id_tarea_operario: string;
    descripcion: string;
  };
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Aviso al terminar; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

// Anular una tarea desde su fila (entrega 10.8a). Confirma con el boton destructivo
// y dice la consecuencia real: la mano de obra de un costeo se estima con las
// tareas no anuladas solo al generarlo, y el recalculo conserva la guardada, asi
// que la tarea anulada deja de contar en los costeos que se generen despues.
export function TaskCancelAction({ task, action, successNotification }: TaskCancelActionProps) {
  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_tarea_operario: task.id_tarea_operario }}
      variant="destructive"
      size="sm"
      successNotification={successNotification}
      confirm={{
        title: `¿Anular la tarea ${task.id_tarea_operario}?`,
        description:
          "Dejará de contar en la mano de obra de los costeos que se generen después. Los costeos ya generados no cambian.",
        confirmText: "Anular",
      }}
      pendingText="Anulando..."
    >
      Anular
    </ConfirmActionButton>
  );
}
