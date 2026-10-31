import { RowStatusSelect } from "@/components/forms/row-status-select";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type FailureStatusSelectProps = {
  failure: {
    id_falla: string;
    estado_atencion: string;
  };
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Aviso al guardar; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

const OPTIONS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_atencion", label: "En atención" },
  { value: "reparada", label: "Reparada" },
  { value: "anulada", label: "Anulada" },
];

// Estados finales: la accion rechaza cambiar una falla cerrada y el alta de
// reparaciones rechaza registrar una sobre ella.
const CLOSED_CONSEQUENCE = "No se podrá cambiar su estado ni registrar reparaciones sobre ella.";

// Cambiar el estado de una falla desde su fila (entrega 10.5b). Reparada y
// Anulada no se pueden deshacer: piden confirmar. Una falla cerrada no ofrece
// selector (hallazgo 8 de la auditoria de la 10.5).
export function FailureStatusSelect({ failure, action, successNotification }: FailureStatusSelectProps) {
  if (["reparada", "anulada"].includes(failure.estado_atencion)) {
    return <span className="text-xs text-muted-foreground">Sin accion</span>;
  }

  return (
    <RowStatusSelect
      action={action}
      id={`estado-${failure.id_falla}`}
      fields={{ id_falla: failure.id_falla }}
      name="estado_atencion"
      label={`Estado de la falla ${failure.id_falla}`}
      value={failure.estado_atencion}
      options={OPTIONS}
      successNotification={successNotification}
      confirm={{
        reparada: {
          title: `¿Marcar la falla ${failure.id_falla} como reparada?`,
          description: CLOSED_CONSEQUENCE,
          confirmText: "Marcar reparada",
          variant: "default",
        },
        anulada: {
          title: `¿Anular la falla ${failure.id_falla}?`,
          description: `${CLOSED_CONSEQUENCE} Se conserva en la lista.`,
          confirmText: "Anular",
        },
      }}
    />
  );
}
