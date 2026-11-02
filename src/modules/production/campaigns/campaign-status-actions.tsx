import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type CampaignStatusActionsProps = {
  campaign: {
    id_campania: string;
    nombre_campania: string;
    estado: string;
  };
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Avisos al terminar; la pagina los pasa con su clave literal. */
  activatedNotification: NotificationDefinition;
  finishedNotification: NotificationDefinition;
  annulledNotification: NotificationDefinition;
};

// Activar, finalizar y anular una campana desde su fila (entrega 10.7a). Cada boton
// solo aparece en el estado desde el que se ofrece, y la accion lo vuelve a comprobar
// con la campana bloqueada. Activar no destruye nada y se ejecuta al pulsar; finalizar
// no se deshace pero tampoco borra: confirma con el boton normal (D4 de la 10.7). Las
// consecuencias son las de crear una orden, que solo admite planificadas y activas.
export function CampaignStatusActions({
  campaign,
  action,
  activatedNotification,
  finishedNotification,
  annulledNotification,
}: CampaignStatusActionsProps) {
  const fieldsFor = (estado: string) => ({ id_campania: campaign.id_campania, estado });

  return (
    <>
      {campaign.estado === "planificada" ? (
        <ConfirmActionButton
          action={action}
          fields={fieldsFor("activa")}
          variant="outline"
          size="sm"
          successNotification={activatedNotification}
          pendingText="Activando..."
        >
          Activar
        </ConfirmActionButton>
      ) : null}

      {campaign.estado === "activa" ? (
        <ConfirmActionButton
          action={action}
          fields={fieldsFor("finalizada")}
          variant="outline"
          size="sm"
          successNotification={finishedNotification}
          confirm={{
            title: `¿Finalizar la campaña ${campaign.nombre_campania}?`,
            description:
              "No se podrán agregar productos ni crear órdenes de trabajo para ella. Después solo se podrá anular.",
            confirmText: "Finalizar",
            variant: "default",
          }}
          pendingText="Finalizando..."
        >
          Finalizar
        </ConfirmActionButton>
      ) : null}

      {["planificada", "activa"].includes(campaign.estado) ? (
        <ConfirmActionButton
          action={action}
          fields={fieldsFor("anulada")}
          variant="destructive"
          size="sm"
          successNotification={annulledNotification}
          confirm={{
            title: `¿Anular la campaña ${campaign.nombre_campania}?`,
            description:
              "No se podrá editar, agregar productos ni crear órdenes de trabajo para ella. Las órdenes ya creadas se conservan. No se puede deshacer.",
            confirmText: "Anular",
          }}
          pendingText="Anulando..."
        >
          Anular
        </ConfirmActionButton>
      ) : null}
    </>
  );
}
