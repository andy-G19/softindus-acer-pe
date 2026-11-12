import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type OrderCancelActionProps = {
  idPedido: string;
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Aviso al terminar; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

// Cancelar un pedido desde su fila del listado (C8 de la 11.3b, D34). Confirma con el boton
// destructivo y la consecuencia de cancelOrderAction: el pedido queda cancelado y la regla comun
// (order-rules.ts) ya no deja editarlo, y getQuotableOrders ya no lo ofrece para una proforma.
// El boton que cierra dice «Volver»: con «Cancelar» habria dos botones que dicen lo mismo. Un
// rechazo (tiene una proforma activa, un comprobante emitido o una orden de trabajo) queda en la
// confirmacion.
export function OrderCancelAction({ idPedido, action, successNotification }: OrderCancelActionProps) {
  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_pedido: idPedido }}
      variant="destructive"
      size="sm"
      successNotification={successNotification}
      confirm={{
        title: `¿Cancelar el pedido ${idPedido}?`,
        description:
          "El pedido queda cancelado: ya no se puede editar ni generar su proforma. No se puede deshacer.",
        confirmText: "Cancelar pedido",
        cancelText: "Volver",
      }}
      pendingText="Cancelando..."
    >
      Cancelar
    </ConfirmActionButton>
  );
}
