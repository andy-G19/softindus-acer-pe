import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { StatusToggleState } from "@/lib/requested-status";

type RouteStatusButtonProps = {
  route: {
    id_ruta: string;
    nombre_ruta: string;
    estado: boolean;
  };
  action: (prevState: StatusToggleState, formData: FormData) => Promise<StatusToggleState>;
  /** Avisos al activar e inactivar; la pagina los pasa con su clave literal. */
  activatedNotification: NotificationDefinition;
  deactivatedNotification: NotificationDefinition;
};

// Activar o inactivar una ruta desde su fila (entrega 10.6a). Inactivar pide
// confirmar con el nombre y la consecuencia comprobada en el codigo: el formulario
// de ordenes solo ofrece rutas activas y crear una orden las exige, el alta de
// etapa las exige y el inicio de Produccion las cuenta en Rutas activas; las
// ordenes ya creadas no se bloquean y pueden generar sus avances. Activar se
// ejecuta al pulsar. Los dos envian el estado pedido y dan su aviso con el
// resultado.
export function RouteStatusButton({
  route,
  action,
  activatedNotification,
  deactivatedNotification,
}: RouteStatusButtonProps) {
  if (!route.estado) {
    return (
      <ConfirmActionButton
        action={action}
        fields={{ id_ruta: route.id_ruta, estado: "true" }}
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
      fields={{ id_ruta: route.id_ruta, estado: "false" }}
      variant="destructive"
      successNotification={deactivatedNotification}
      confirm={{
        title: `¿Inactivar la ruta ${route.nombre_ruta}?`,
        description:
          "Dejará de ofrecerse en las órdenes de trabajo nuevas, no admitirá etapas nuevas y no contará en Rutas activas. Sus etapas y las órdenes ya creadas se conservan, y esas órdenes pueden seguir generando sus avances. Puedes volver a activarla.",
        confirmText: "Inactivar",
      }}
      pendingText="Inactivando..."
    >
      Inactivar
    </ConfirmActionButton>
  );
}
