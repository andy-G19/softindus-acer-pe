import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { StockAlertAttendState } from "@/modules/inventory/alerts/actions";

type StockAlertAttendButtonProps = {
  alert: {
    id_alerta: string;
    /** Nombre del material, o su id si ya no se encuentra. */
    materialName: string;
  };
  action: (prevState: StockAlertAttendState, formData: FormData) => Promise<StockAlertAttendState>;
  /** Aviso al atender; la pagina lo pasa con su clave literal. */
  attendedNotification: NotificationDefinition;
};

// Atender una alerta de stock desde su fila (entrega 10.3, decision D4). No
// borra ni anula nada, pero no se puede deshacer: confirma con el boton normal
// (no el destructivo) y la consecuencia. «Stock critico actual» se calcula
// con el stock de cada material, no con las alertas, asi que el material sigue
// alli mientras no supere el minimo.
export function StockAlertAttendButton({ alert, action, attendedNotification }: StockAlertAttendButtonProps) {
  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_alerta: alert.id_alerta }}
      variant="outline"
      successNotification={attendedNotification}
      confirm={{
        title: `¿Marcar atendida la alerta de ${alert.materialName}?`,
        description:
          "La alerta pasará a atendida y no se puede reactivar. Si el material sigue bajo el mínimo, seguirá en Stock crítico actual.",
        confirmText: "Marcar atendida",
        variant: "default",
      }}
      pendingText="Atendiendo..."
    >
      Marcar atendida
    </ConfirmActionButton>
  );
}
