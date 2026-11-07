import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type CostingRecalculateActionProps = {
  idCosteo: string;
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Aviso al terminar; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

// Recalcular el costeo desde su detalle (B5 de la 10.8b, D6). No anula nada, asi que
// confirma con el boton normal, y dice lo que hace recalculateCostingTotals: conserva
// materiales, consumibles y mano de obra guardados y suma los costos indirectos vigentes
// (los anulados valen 0).
export function CostingRecalculateAction({ idCosteo, action, successNotification }: CostingRecalculateActionProps) {
  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_costeo: idCosteo }}
      variant="outline"
      successNotification={successNotification}
      confirm={{
        title: `¿Recalcular el costeo ${idCosteo}?`,
        description:
          "Conserva los materiales, los consumibles y la mano de obra guardados, y suma los costos indirectos vigentes. Se actualizan el costo total y el unitario.",
        confirmText: "Recalcular",
        variant: "default",
      }}
      pendingText="Recalculando..."
    >
      Recalcular costeo
    </ConfirmActionButton>
  );
}
