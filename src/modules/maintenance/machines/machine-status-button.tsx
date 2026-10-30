import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { StatusToggleState } from "@/lib/requested-status";

type MachineStatusButtonProps = {
  machine: {
    id_maquina: string;
    nombre: string;
    estado: string;
  };
  action: (prevState: StatusToggleState, formData: FormData) => Promise<StatusToggleState>;
  /** Avisos al activar e inactivar; la pagina los pasa con su clave literal. */
  activatedNotification: NotificationDefinition;
  deactivatedNotification: NotificationDefinition;
};

// Activar o inactivar una maquina desde su fila (entrega 10.5a). Una maquina
// inactiva ofrece Activar, que la deja operativa y se ejecuta al pulsar; en
// cualquier otro estado (operativa, en mantenimiento o fuera de servicio)
// ofrece Inactivar, que pide confirmar con el nombre y la consecuencia
// comprobada en el codigo: registrar una falla rechaza una maquina inactiva,
// las etapas de produccion no la ofrecen ni dejan asignarla y el inicio de
// Mantenimiento no la cuenta como operativa; lo ya registrado se conserva.
// Los dos envian el estado pedido y dan su aviso con el resultado.
export function MachineStatusButton({
  machine,
  action,
  activatedNotification,
  deactivatedNotification,
}: MachineStatusButtonProps) {
  if (machine.estado === "inactiva") {
    return (
      <ConfirmActionButton
        action={action}
        fields={{ id_maquina: machine.id_maquina, estado: "true" }}
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
      fields={{ id_maquina: machine.id_maquina, estado: "false" }}
      variant="destructive"
      successNotification={deactivatedNotification}
      confirm={{
        title: `¿Inactivar la máquina ${machine.nombre}?`,
        description:
          "No se podrán registrar fallas sobre ella ni asignarla a etapas de producción, y no contará como operativa en el inicio de Mantenimiento. Sus fallas, preventivos, reparaciones y etapas se conservan. Al activarla vuelve a quedar operativa.",
        confirmText: "Inactivar",
      }}
      pendingText="Inactivando..."
    >
      Inactivar
    </ConfirmActionButton>
  );
}
