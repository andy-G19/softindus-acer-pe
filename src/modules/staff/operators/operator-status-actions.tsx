import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type OperatorStatusActionsProps = {
  operator: {
    id_operario: string;
    nombre: string;
    estado: string;
  };
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Avisos al terminar; la pagina los pasa con su clave literal. */
  activatedNotification: NotificationDefinition;
  deactivatedNotification: NotificationDefinition;
};

// Activar e inactivar un operario desde su fila (entrega 10.8a), como Usuarios.
// Activar no destruye nada y se aplica al pulsar; inactivar confirma con el boton
// destructivo y dice la consecuencia real: los formularios de asistencia, tareas,
// planillas y la reasignacion de avances solo ofrecen operarios activos, y lo ya
// registrado no cambia.
export function OperatorStatusActions({
  operator,
  action,
  activatedNotification,
  deactivatedNotification,
}: OperatorStatusActionsProps) {
  if (operator.estado !== "activo") {
    return (
      <ConfirmActionButton
        action={action}
        fields={{ id_operario: operator.id_operario, estado: "activo" }}
        variant="outline"
        size="sm"
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
      fields={{ id_operario: operator.id_operario, estado: "inactivo" }}
      variant="destructive"
      size="sm"
      successNotification={deactivatedNotification}
      confirm={{
        title: `¿Inactivar a ${operator.nombre}?`,
        description:
          "No aparecerá al registrar asistencia, tareas ni planillas, ni al reasignar avances, hasta que lo reactives. Sus registros anteriores se conservan.",
        confirmText: "Inactivar",
      }}
      pendingText="Inactivando..."
    >
      Inactivar
    </ConfirmActionButton>
  );
}
