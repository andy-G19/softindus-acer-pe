import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { formatMoney } from "@/lib/formatters";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";
import { isNegativeCashMovement } from "@/modules/petty-cash/movements/movement-direction";

type MovementAnnulActionProps = {
  /**
   * La fila del movimiento, tal como la carga el listado: su id (lo que se envia), su concepto y su
   * monto (lo que la confirmacion nombra) y su tipo, que con el concepto dice hacia donde va el
   * dinero al anular, con la misma regla que la accion (movement-direction.ts). Recibir la fila y
   * no campos sueltos evita que la pagina los cruce, como en QuoteAnnulAction.
   */
  movement: {
    id_movimiento_caja: string;
    concepto: string;
    monto: { toString(): string };
    tipo_movimiento: string;
  };
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Aviso al terminar; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

// Anular un movimiento de caja chica desde su fila (C8 de la 11.4a, D47), como anular proforma.
// Confirma con el boton destructivo y la consecuencia real de annulPettyCashMovementAction: el
// movimiento queda anulado y su monto vuelve a la caja o se descuenta de ella. Un rechazo (ya
// anulado, caja cerrada, saldo insuficiente, ingreso de una venta de chatarra) queda en la
// confirmacion.
export function MovementAnnulAction({ movement, action, successNotification }: MovementAnnulActionProps) {
  // Un egreso o un ajuste negativo devuelven su monto a la caja; un ingreso o un ajuste positivo
  // lo descuentan de ella.
  const consequence = isNegativeCashMovement(movement.tipo_movimiento, movement.concepto)
    ? "El movimiento queda anulado y su monto vuelve a la caja. No se puede deshacer."
    : "El movimiento queda anulado y su monto se descuenta de la caja. No se puede deshacer.";

  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_movimiento_caja: movement.id_movimiento_caja }}
      variant="destructive"
      size="sm"
      successNotification={successNotification}
      confirm={{
        title: `¿Anular «${movement.concepto}» por ${formatMoney(movement.monto)}?`,
        description: consequence,
        confirmText: "Anular",
      }}
      pendingText="Anulando..."
    >
      Anular
    </ConfirmActionButton>
  );
}
