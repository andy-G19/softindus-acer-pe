import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { formatDate } from "@/lib/formatters";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type PayrollAnnulActionProps = {
  /**
   * La planilla con su id (lo que se envia), su operario y su periodo (con lo que la confirmacion
   * la nombra). Recibir la fila y no textos sueltos evita que una pagina los cruce.
   */
  payroll: {
    id_planilla: string;
    periodo_inicio: Date;
    periodo_fin: Date;
    operario: { nombres: string; apellidos: string };
  };
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Aviso al terminar; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

// Anular una planilla desde su fila del listado (C8 de la 11.5, D60), como anular una proforma.
// Confirma con el boton destructivo y la consecuencia de cancelPayrollAction y de generar: la
// planilla queda anulada y ya no se puede pagar; sus dias pueden entrar en otra planilla (el cruce
// no cuenta las anuladas, D55), pero no con el mismo periodo exacto, que la comprobacion del
// periodo repetido y el indice unico siguen ocupando (D57). Un rechazo (pagada, con un pago, ya
// anulada) queda en la confirmacion.
export function PayrollAnnulAction({ payroll, action, successNotification }: PayrollAnnulActionProps) {
  const period = `${formatDate(payroll.periodo_inicio, { format: "dd/mm/yyyy" })} al ${formatDate(
    payroll.periodo_fin,
    { format: "dd/mm/yyyy" },
  )}`;

  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_planilla: payroll.id_planilla }}
      variant="destructive"
      size="sm"
      successNotification={successNotification}
      confirm={{
        title: `¿Anular la planilla ${payroll.id_planilla}?`,
        description: `La planilla de ${payroll.operario.apellidos}, ${payroll.operario.nombres} del ${period} queda anulada y ya no se puede pagar. Sus días pueden entrar en otra planilla, pero no con este mismo periodo. No se puede deshacer.`,
        confirmText: "Anular",
      }}
      pendingText="Anulando..."
    >
      Anular
    </ConfirmActionButton>
  );
}
