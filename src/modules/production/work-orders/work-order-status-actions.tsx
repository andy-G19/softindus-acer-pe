import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type WorkOrderStatusActionProps = {
  /**
   * La orden con su id (lo que se envía) y su producto (lo que nombra la confirmación). Recibir la
   * fila y no dos textos evita que una página los cruce.
   */
  order: { id_orden_trabajo: string; producto: { nombre_producto: string } };
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Aviso al terminar; la página lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

// Anular una orden desde su fila del listado (C4 de la 11.6b, D76). Reemplaza al último
// ConfirmDeleteButton de las páginas. Confirma con el botón destructivo y la consecuencia de
// annulWorkOrder: la orden anulada ya no recibe material (entregar la rechaza) ni se puede
// finalizar. El pedido de la orden no cambia (D77). Un rechazo (tiene movimientos de material,
// está finalizada, ya estaba anulada) queda en la confirmación.
export function WorkOrderAnnulAction({ order, action, successNotification }: WorkOrderStatusActionProps) {
  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_orden_trabajo: order.id_orden_trabajo }}
      variant="destructive"
      size="sm"
      successNotification={successNotification}
      confirm={{
        title: `¿Anular la orden ${order.id_orden_trabajo}?`,
        description: `La orden de ${order.producto.nombre_producto} queda anulada: ya no recibe material ni se puede finalizar. No se puede deshacer.`,
        confirmText: "Anular",
        variant: "destructive",
      }}
      pendingText="Anulando..."
    >
      Anular
    </ConfirmActionButton>
  );
}

// Finalizar una orden desde su fila del listado (C4 de la 11.6b, D76). No anula nada: confirma con
// el botón normal y la consecuencia de finishWorkOrder (fecha de entrega real de hoy; entregar
// material la rechaza). Un rechazo (etapas sin terminar, ya estaba finalizada) queda en la
// confirmación. Tras finalizar se queda en el listado repintado; antes iba al detalle.
export function WorkOrderFinishAction({ order, action, successNotification }: WorkOrderStatusActionProps) {
  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_orden_trabajo: order.id_orden_trabajo }}
      variant="outline"
      size="sm"
      successNotification={successNotification}
      confirm={{
        title: `¿Finalizar la orden ${order.id_orden_trabajo}?`,
        description: `La orden de ${order.producto.nombre_producto} queda finalizada con la fecha de hoy y ya no recibe material.`,
        confirmText: "Finalizar",
        variant: "default",
      }}
      pendingText="Finalizando..."
    >
      Finalizar
    </ConfirmActionButton>
  );
}
