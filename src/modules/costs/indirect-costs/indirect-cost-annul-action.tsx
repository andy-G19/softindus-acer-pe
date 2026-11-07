import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type IndirectCostAnnulActionProps = {
  indirectCost: {
    id_costo_indirecto: string;
    concepto: string;
  };
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Aviso al terminar; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

// Anular un costo indirecto desde su fila del detalle (B5 de la 10.8b, D6). Confirma con
// el boton destructivo y la consecuencia de annulIndirectCostAction: el monto pasa a 0, se
// recalculan los totales y el monto original queda en las observaciones con [ANULADO].
export function IndirectCostAnnulAction({ indirectCost, action, successNotification }: IndirectCostAnnulActionProps) {
  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_costo_indirecto: indirectCost.id_costo_indirecto }}
      variant="destructive"
      size="sm"
      successNotification={successNotification}
      confirm={{
        title: `¿Anular el costo indirecto «${indirectCost.concepto}»?`,
        description:
          "Su monto pasa a S/ 0.00 y deja de sumar al costeo; se recalculan el costo total y el unitario. El monto original queda en sus observaciones.",
        confirmText: "Anular",
      }}
      pendingText="Anulando..."
    >
      Anular
    </ConfirmActionButton>
  );
}
