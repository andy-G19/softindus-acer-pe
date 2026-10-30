import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { StatusToggleState } from "@/lib/requested-status";

type SparePartStatusButtonProps = {
  sparePart: {
    id_repuesto: string;
    nombre_repuesto: string;
    estado: boolean;
  };
  action: (prevState: StatusToggleState, formData: FormData) => Promise<StatusToggleState>;
  /** Avisos al activar e inactivar; la pagina los pasa con su clave literal. */
  activatedNotification: NotificationDefinition;
  deactivatedNotification: NotificationDefinition;
};

// Activar o inactivar un repuesto desde su fila (entrega 10.5a). Inactivar pide
// confirmar con el nombre y la consecuencia comprobada en el codigo: el
// formulario de reparaciones solo ofrece repuestos activos y la accion rechaza
// uno inactivo; las reparaciones que ya lo usan lo conservan. Activar se
// ejecuta al pulsar. Los dos envian el estado pedido y dan su aviso con el
// resultado.
export function SparePartStatusButton({
  sparePart,
  action,
  activatedNotification,
  deactivatedNotification,
}: SparePartStatusButtonProps) {
  if (!sparePart.estado) {
    return (
      <ConfirmActionButton
        action={action}
        fields={{ id_repuesto: sparePart.id_repuesto, estado: "true" }}
        variant="ghost"
        successNotification={activatedNotification}
        pendingText="Activando..."
      >
        Activar
      </ConfirmActionButton>
    );
  }

  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_repuesto: sparePart.id_repuesto, estado: "false" }}
      variant="destructive"
      successNotification={deactivatedNotification}
      confirm={{
        title: `¿Inactivar el repuesto ${sparePart.nombre_repuesto}?`,
        description:
          "Dejará de ofrecerse al registrar reparaciones. Las reparaciones que ya lo usan lo conservan. Puedes volver a activarlo.",
        confirmText: "Inactivar",
      }}
      pendingText="Inactivando..."
    >
      Inactivar
    </ConfirmActionButton>
  );
}
