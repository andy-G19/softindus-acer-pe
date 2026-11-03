import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type ReusableScrapStatusActionsProps = {
  scrap: {
    id_retazo: string;
    estado: string;
  };
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Avisos al terminar; la pagina los pasa con su clave literal. */
  reusedNotification: NotificationDefinition;
  discardedNotification: NotificationDefinition;
};

// Reutilizar y descartar un retazo desde su fila (entrega 10.7a). Solo un retazo
// disponible cambia de estado y ninguno de los dos cambios se deshace: reutilizar
// confirma con el boton normal porque no destruye nada, y descartar con el destructivo.
export function ReusableScrapStatusActions({
  scrap,
  action,
  reusedNotification,
  discardedNotification,
}: ReusableScrapStatusActionsProps) {
  if (scrap.estado !== "disponible") {
    return <span className="text-sm text-muted-foreground">Sin acción</span>;
  }

  return (
    <div className="flex flex-col gap-2">
      <ConfirmActionButton
        action={action}
        fields={{ id_retazo: scrap.id_retazo, estado: "reutilizado" }}
        variant="outline"
        size="sm"
        successNotification={reusedNotification}
        confirm={{
          title: `¿Marcar el retazo ${scrap.id_retazo} como reutilizado?`,
          description: "Dejará de estar disponible y no se podrá cambiar su estado.",
          confirmText: "Reutilizar",
          variant: "default",
        }}
        pendingText="Guardando..."
      >
        Reutilizar
      </ConfirmActionButton>

      <ConfirmActionButton
        action={action}
        fields={{ id_retazo: scrap.id_retazo, estado: "descartado" }}
        variant="destructive"
        size="sm"
        successNotification={discardedNotification}
        confirm={{
          title: `¿Descartar el retazo ${scrap.id_retazo}?`,
          description: "Dejará de estar disponible y se conserva en la lista como descartado. No se puede deshacer.",
          confirmText: "Descartar",
        }}
        pendingText="Descartando..."
      >
        Descartar
      </ConfirmActionButton>
    </div>
  );
}
