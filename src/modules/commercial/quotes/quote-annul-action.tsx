import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type QuoteAnnulActionProps = {
  idProforma: string;
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Aviso al terminar; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

// Anular una proforma desde su fila del listado o desde su detalle (C6 de la 11.3a, D28), como
// anular compra. Confirma con el boton destructivo y la consecuencia de annulQuoteAction: la
// proforma queda anulada y su pedido vuelve a admitir una proforma nueva (getQuotableOrders solo
// excluye los pedidos con una proforma vigente, aceptada o pagada). Un rechazo (tiene pagos, tiene
// un comprobante emitido, ya estaba anulada) queda en la confirmacion.
export function QuoteAnnulAction({ idProforma, action, successNotification }: QuoteAnnulActionProps) {
  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_proforma: idProforma }}
      variant="destructive"
      size="sm"
      successNotification={successNotification}
      confirm={{
        title: `¿Anular la proforma ${idProforma}?`,
        description:
          "La proforma queda anulada y su pedido vuelve a admitir una proforma nueva. No se puede deshacer.",
        confirmText: "Anular",
      }}
      pendingText="Anulando..."
    >
      Anular
    </ConfirmActionButton>
  );
}
