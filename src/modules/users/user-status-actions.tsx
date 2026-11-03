import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type UserStatusActionsProps = {
  user: {
    id_usuario: string;
    nombre: string;
    estado: string;
  };
  /** El usuario de la fila es el de la sesion: no puede desactivarse. */
  isSelf: boolean;
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Avisos al terminar; la pagina los pasa con su clave literal. */
  activatedNotification: NotificationDefinition;
  deactivatedNotification: NotificationDefinition;
};

// Activar y desactivar un usuario desde su fila (entrega 10.7b). Activar no destruye
// nada y se aplica al pulsar; desactivar confirma con el boton destructivo (D4 de la
// 10.7) y dice la consecuencia real: auth.ts revisa el estado en cada peticion, asi
// que la sesion abierta se corta en la siguiente. El administrador ve su propio
// boton deshabilitado; la accion lo vuelve a rechazar.
export function UserStatusActions({
  user,
  isSelf,
  action,
  activatedNotification,
  deactivatedNotification,
}: UserStatusActionsProps) {
  if (user.estado !== "activo") {
    return (
      <ConfirmActionButton
        action={action}
        fields={{ id_usuario: user.id_usuario, estado: "activo" }}
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
      fields={{ id_usuario: user.id_usuario, estado: "inactivo" }}
      variant="destructive"
      size="sm"
      successNotification={deactivatedNotification}
      disabled={isSelf}
      confirm={{
        title: `¿Desactivar a ${user.nombre}?`,
        description:
          "No podrá iniciar sesión y su sesión abierta se cierra en su próxima acción, hasta que lo reactives.",
        confirmText: "Desactivar",
      }}
      pendingText="Desactivando..."
    >
      Desactivar
    </ConfirmActionButton>
  );
}
