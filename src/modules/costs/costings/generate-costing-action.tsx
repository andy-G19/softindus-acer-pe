"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { CostingFromWorkOrderState } from "@/modules/costs/costings/actions";

type GenerateCostingActionProps = {
  idOrdenTrabajo: string;
  action: (prevState: CostingFromWorkOrderState, formData: FormData) => Promise<CostingFromWorkOrderState>;
  /** Avisos del catalogo de Costos; la pagina los pasa con su clave literal. */
  createdNotification: NotificationDefinition;
  existingNotification: NotificationDefinition;
};

const COSTINGS_PATH = "/dashboard/costs/costings";

// Generar el costeo de una orden desde su fila (B6 de la 10.8b, D5). No anula nada:
// confirma con el boton normal y dice lo que calcula createCostingInTransaction. Al
// terminar navega al costeo: el creado, o el que la orden ya tenia (una lista vieja o un
// doble clic), con un aviso informativo. Un rechazo queda dentro de la confirmacion.
export function GenerateCostingAction({
  idOrdenTrabajo,
  action,
  createdNotification,
  existingNotification,
}: GenerateCostingActionProps) {
  const router = useRouter();

  const notificationFor = useCallback(
    (data: { existente: boolean }) => (data.existente ? existingNotification : createdNotification),
    [createdNotification, existingNotification],
  );
  const openCosting = useCallback(
    (data: { id_costeo: string }) => router.push(`${COSTINGS_PATH}/${data.id_costeo}`),
    [router],
  );

  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_orden_trabajo: idOrdenTrabajo }}
      variant="default"
      size="sm"
      successNotification={notificationFor}
      onSuccess={openCosting}
      confirm={{
        title: `¿Generar el costeo de la orden ${idOrdenTrabajo}?`,
        description:
          "Calcula los materiales y consumibles con la receta guardada en la orden y el costo actual de cada material, y la mano de obra con las horas de sus tareas no anuladas y la tarifa de cada operario. Los costos indirectos empiezan en cero.",
        confirmText: "Generar costeo",
        variant: "default",
      }}
      pendingText="Generando..."
    >
      Generar costeo
    </ConfirmActionButton>
  );
}
