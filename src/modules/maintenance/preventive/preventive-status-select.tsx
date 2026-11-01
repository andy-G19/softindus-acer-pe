import { RowStatusSelect } from "@/components/forms/row-status-select";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type PreventiveStatusSelectProps = {
  maintenance: {
    id_mantenimiento: string;
    estado: string;
  };
  /** Pendiente con fecha pasada: la lista lo muestra «Vencido». */
  isOverdue: boolean;
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Aviso al guardar; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

const OPTIONS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "realizado", label: "Realizado" },
  { value: "vencido", label: "Vencido" },
  { value: "anulado", label: "Anulado" },
];

// Cambiar el estado de un preventivo desde su fila (entrega 10.5b). Realizado y
// Anulado no se pueden deshacer: la accion rechaza cambiarlos, y piden
// confirmar. Un pendiente con fecha pasada se muestra «Vencido» sin estar
// guardado asi: guardarlo es un cambio real.
export function PreventiveStatusSelect({
  maintenance,
  isOverdue,
  action,
  successNotification,
}: PreventiveStatusSelectProps) {
  if (["realizado", "anulado"].includes(maintenance.estado)) {
    return <span className="text-xs text-muted-foreground">Sin accion</span>;
  }

  return (
    <RowStatusSelect
      action={action}
      id={`estado-${maintenance.id_mantenimiento}`}
      fields={{ id_mantenimiento: maintenance.id_mantenimiento }}
      name="estado"
      label={`Estado del mantenimiento ${maintenance.id_mantenimiento}`}
      value={isOverdue ? "vencido" : maintenance.estado}
      storedValue={maintenance.estado}
      options={OPTIONS}
      successNotification={successNotification}
      confirm={{
        realizado: {
          title: `¿Marcar el mantenimiento ${maintenance.id_mantenimiento} como realizado?`,
          description: "La fecha de hoy quedará como fecha realizada. No se podrá cambiar su estado.",
          confirmText: "Marcar realizado",
          variant: "default",
        },
        anulado: {
          title: `¿Anular el mantenimiento ${maintenance.id_mantenimiento}?`,
          description: "No se podrá cambiar su estado. Se conserva en la lista.",
          confirmText: "Anular",
        },
      }}
    />
  );
}
