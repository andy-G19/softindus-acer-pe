import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

/** Un material que sale del almacén: lo pendiente ya redondeado como lo entrega la acción. */
export type PendingDeliveryLine = {
  materialName: string;
  quantity: string;
  unidad: string;
};

type DeliverPendingActionProps = {
  idOrdenTrabajo: string;
  /** Con entregas previas se entrega lo que falta; sin ellas, la primera entrega. */
  hasDeliveries: boolean;
  lines: PendingDeliveryLine[];
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Aviso al terminar; la página lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

function describeDelivery(lines: PendingDeliveryLine[]) {
  const detail = lines.map((line) => `${line.materialName} ${line.quantity} ${line.unidad}`).join(", ");

  return lines.length === 1
    ? `Sale del almacén 1 material: ${detail}. Se descuenta del stock y queda en el kardex.`
    : `Salen del almacén ${lines.length} materiales: ${detail}. Se descuentan del stock y quedan en el kardex.`;
}

// Entregar lo pendiente desde la cabecera del detalle (C3 de la 11.6b, D75). Confirma con el botón
// normal, no el destructivo: no anula nada, pero saca material del almacén, y la confirmación dice
// cuánto sale de cada material. Un rechazo (stock insuficiente, material inactivo, nada pendiente)
// queda dentro de la confirmación; el detalle se repinta con la revalidación de la acción.
export function DeliverPendingAction({
  idOrdenTrabajo,
  hasDeliveries,
  lines,
  action,
  successNotification,
}: DeliverPendingActionProps) {
  const label = hasDeliveries ? "Entregar lo pendiente" : "Entregar materiales";

  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_orden_trabajo: idOrdenTrabajo }}
      variant="default"
      size="default"
      successNotification={successNotification}
      confirm={{
        title: `¿Entregar los materiales de la orden ${idOrdenTrabajo}?`,
        description: describeDelivery(lines),
        confirmText: "Entregar",
        variant: "default",
      }}
      pendingText="Entregando..."
    >
      {label}
    </ConfirmActionButton>
  );
}
