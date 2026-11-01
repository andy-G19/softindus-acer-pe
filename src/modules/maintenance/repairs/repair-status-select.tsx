import { RowStatusSelect } from "@/components/forms/row-status-select";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type RepairStatusSelectProps = {
  repair: {
    id_reparacion: string;
    estado_reparacion: string;
  };
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** Aviso al guardar; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

const OPTIONS = [
  { value: "programada", label: "Programada" },
  { value: "ejecutada", label: "Ejecutada" },
  { value: "observada", label: "Observada" },
  { value: "anulada", label: "Anulada" },
];

// Cambiar el estado de una reparacion desde su fila (entrega 10.5b). Ejecutada y
// Anulada no se pueden deshacer: la accion rechaza cambiarlas, y piden
// confirmar con lo que hacen sobre la falla y la maquina (comprobado en
// updateRepairStatusAction; que anular deje la maquina como esta es el hallazgo
// 12 de la auditoria de la 10.5).
export function RepairStatusSelect({ repair, action, successNotification }: RepairStatusSelectProps) {
  if (["ejecutada", "anulada"].includes(repair.estado_reparacion)) {
    return <span className="text-xs text-muted-foreground">Sin accion</span>;
  }

  return (
    <RowStatusSelect
      action={action}
      id={`estado-${repair.id_reparacion}`}
      fields={{ id_reparacion: repair.id_reparacion }}
      name="estado_reparacion"
      label={`Estado de la reparación ${repair.id_reparacion}`}
      value={repair.estado_reparacion}
      options={OPTIONS}
      successNotification={successNotification}
      confirm={{
        ejecutada: {
          title: `¿Marcar la reparación ${repair.id_reparacion} como ejecutada?`,
          description: "La falla quedará reparada y la máquina, operativa. No se podrá cambiar su estado.",
          confirmText: "Marcar ejecutada",
          variant: "default",
        },
        anulada: {
          title: `¿Anular la reparación ${repair.id_reparacion}?`,
          description: "La falla volverá a pendiente y la máquina no cambia de estado. No se podrá cambiar el estado de la reparación.",
          confirmText: "Anular",
        },
      }}
    />
  );
}
