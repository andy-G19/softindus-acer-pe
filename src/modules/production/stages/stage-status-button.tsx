import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { StatusToggleState } from "@/lib/requested-status";

type StageStatusButtonProps = {
  stage: {
    id_etapa_ruta: string;
    nombre_etapa: string;
    estado: boolean;
  };
  action: (prevState: StatusToggleState, formData: FormData) => Promise<StatusToggleState>;
  /** Avisos al activar e inactivar; la pagina los pasa con su clave literal. */
  activatedNotification: NotificationDefinition;
  deactivatedNotification: NotificationDefinition;
};

// Activar o inactivar una etapa desde su fila (entrega 10.6a). Inactivar pide
// confirmar con el nombre y la consecuencia comprobada en el codigo: generar los
// avances de una orden solo toma etapas activas, las tareas nuevas solo las
// ofrecen a ellas, los minutos por unidad de la ruta solo las suman, y crear una
// orden exige al menos una en la ruta. Activar se ejecuta al pulsar. Los dos
// envian el estado pedido y dan su aviso con el resultado.
export function StageStatusButton({
  stage,
  action,
  activatedNotification,
  deactivatedNotification,
}: StageStatusButtonProps) {
  if (!stage.estado) {
    return (
      <ConfirmActionButton
        action={action}
        fields={{ id_etapa_ruta: stage.id_etapa_ruta, estado: "true" }}
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
      fields={{ id_etapa_ruta: stage.id_etapa_ruta, estado: "false" }}
      variant="destructive"
      successNotification={deactivatedNotification}
      confirm={{
        title: `¿Inactivar la etapa ${stage.nombre_etapa}?`,
        description:
          "No entrará en los avances que se generen desde ahora, no se ofrecerá en tareas nuevas y dejará de sumar en los minutos por unidad de la ruta. Si es la última etapa activa, la ruta no servirá para órdenes nuevas. Los avances y tareas ya registrados se conservan. Puedes volver a activarla.",
        confirmText: "Inactivar",
      }}
      pendingText="Inactivando..."
    >
      Inactivar
    </ConfirmActionButton>
  );
}
