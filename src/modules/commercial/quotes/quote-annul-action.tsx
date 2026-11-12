import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type QuoteAnnulActionProps = {
  /**
   * La proforma con su id (lo que se envia) y su numero (lo que muestran el listado y el detalle,
   * PF-…): la confirmacion la nombra por el numero, no por su id interno (C9 de la 11.3b, hallazgo
   * 9 de la 11.3a). Recibir la fila y no dos textos evita que una pagina los cruce.
   */
  quote: { id_proforma: string; numero_proforma: string };
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Aviso al terminar; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

// Anular una proforma desde su fila del listado o desde su detalle (C6 de la 11.3a, D28), como
// anular compra. Confirma con el boton destructivo y la consecuencia de annulQuoteAction: la
// proforma queda anulada y su pedido vuelve a admitir una proforma nueva (getQuotableOrders solo
// excluye los pedidos con una proforma vigente, aceptada o pagada). Un rechazo (tiene pagos, tiene
// un comprobante emitido, ya estaba anulada) queda en la confirmacion.
export function QuoteAnnulAction({ quote, action, successNotification }: QuoteAnnulActionProps) {
  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_proforma: quote.id_proforma }}
      variant="destructive"
      size="sm"
      successNotification={successNotification}
      confirm={{
        title: `¿Anular la proforma ${quote.numero_proforma}?`,
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
