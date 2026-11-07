"use client";

import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { CostingFromWorkOrderState } from "@/modules/costs/costings/actions";

type GenerateCostingActionProps = {
  idOrdenTrabajo: string;
  action: (prevState: CostingFromWorkOrderState, formData: FormData) => Promise<CostingFromWorkOrderState>;
};

// Generar el costeo de una orden desde su fila (B6 de la 10.8b, D5). No anula nada:
// confirma con el boton normal y dice lo que calcula createCostingInTransaction. Con exito
// la accion redirige al costeo, el creado o el que la orden ya tenia, con su aviso en la URL
// (hallazgo 95): el boton no navega ni avisa. Un rechazo queda dentro de la confirmacion.
export function GenerateCostingAction({ idOrdenTrabajo, action }: GenerateCostingActionProps) {
  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_orden_trabajo: idOrdenTrabajo }}
      variant="default"
      size="sm"
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
