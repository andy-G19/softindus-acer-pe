import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type PurchaseAnnulActionProps = {
  idCompra: string;
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Aviso al terminar; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
  /** Texto del boton: «Anular» en la fila del listado, «Anular compra» en el detalle. */
  label?: string;
};

// Anular una compra desde su fila del listado o desde su detalle (C5 de la 11.2a).
// Confirma con el boton destructivo y la consecuencia de annulPurchaseAction: revierte del
// stock lo que ingreso, con su salida en el kardex, y la compra queda anulada. Un rechazo
// (tiene pagos, no hay stock para revertir, ya estaba anulada) queda en la confirmacion.
export function PurchaseAnnulAction({
  idCompra,
  action,
  successNotification,
  label = "Anular",
}: PurchaseAnnulActionProps) {
  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_compra: idCompra }}
      variant="destructive"
      size="sm"
      successNotification={successNotification}
      confirm={{
        title: `¿Anular la compra ${idCompra}?`,
        description:
          "Se revierte del stock lo que ingresó con esta compra, con su salida en el kardex, y la compra queda anulada. No se puede deshacer.",
        confirmText: "Anular",
      }}
      pendingText="Anulando..."
    >
      {label}
    </ConfirmActionButton>
  );
}
