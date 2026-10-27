import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { StatusToggleState } from "@/lib/requested-status";

type ClientStatusButtonProps = {
  client: {
    id_cliente: string;
    nombre_razon_social: string;
    estado: boolean;
  };
  action: (prevState: StatusToggleState, formData: FormData) => Promise<StatusToggleState>;
  /** Avisos al activar e inactivar; la pagina los pasa con su clave literal. */
  activatedNotification: NotificationDefinition;
  deactivatedNotification: NotificationDefinition;
};

// Activar o inactivar un cliente desde su fila (entrega 10.4a); lo pueden
// hacer el administrador y el vendedor. Inactivar pide confirmar con el nombre
// y la consecuencia comprobada en las consultas: el alta y la edicion de
// pedidos solo ofrecen clientes activos, el filtro de clientes del reporte de
// ventas y cobranzas solo los lista a ellos y el inicio de Comercial los
// cuenta en Clientes activos; lo ya registrado los conserva. Activar se
// ejecuta al pulsar. Los dos envian el estado pedido y dan su aviso con el
// resultado.
export function ClientStatusButton({
  client,
  action,
  activatedNotification,
  deactivatedNotification,
}: ClientStatusButtonProps) {
  if (!client.estado) {
    return (
      <ConfirmActionButton
        action={action}
        fields={{ id_cliente: client.id_cliente, estado: "true" }}
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
      fields={{ id_cliente: client.id_cliente, estado: "false" }}
      variant="destructive"
      successNotification={deactivatedNotification}
      confirm={{
        title: `¿Inactivar el cliente ${client.nombre_razon_social}?`,
        description:
          "Dejará de ofrecerse al registrar pedidos o cambiar el cliente de uno, y en el filtro de clientes del reporte de ventas y cobranzas; no contará en Clientes activos. Sus pedidos, proformas, pagos y comprobantes se conservan. Puedes volver a activarlo.",
        confirmText: "Inactivar",
      }}
      pendingText="Inactivando..."
    >
      Inactivar
    </ConfirmActionButton>
  );
}
