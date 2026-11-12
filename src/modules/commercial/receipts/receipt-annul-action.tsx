import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type ReceiptAnnulActionProps = {
  idComprobante: string;
  /** El numero que el listado muestra (B001-…): la confirmacion nombra el comprobante igual. */
  numeroComprobante: string;
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Aviso al terminar; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

// Anular un comprobante desde su fila del listado (C7 de la 11.3b, D33). Confirma con el boton
// destructivo y la consecuencia de annulReceiptAction: el comprobante queda anulado y su proforma
// vuelve a admitir un comprobante nuevo (el detalle solo cuenta los emitidos). Un rechazo (no
// existe, ya estaba anulado) queda en la confirmacion.
export function ReceiptAnnulAction({ idComprobante, numeroComprobante, action, successNotification }: ReceiptAnnulActionProps) {
  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_comprobante: idComprobante }}
      variant="destructive"
      size="sm"
      successNotification={successNotification}
      confirm={{
        title: `¿Anular el comprobante ${numeroComprobante}?`,
        description:
          "El comprobante queda anulado y su proforma vuelve a admitir un comprobante nuevo. No se puede deshacer.",
        confirmText: "Anular",
      }}
      pendingText="Anulando..."
    >
      Anular
    </ConfirmActionButton>
  );
}
