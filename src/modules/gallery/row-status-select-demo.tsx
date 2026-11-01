"use client";

import { useState } from "react";

import { RowStatusSelect } from "@/components/forms/row-status-select";
import type { RowStatusState } from "@/lib/requested-status";

const DEMO_NOTE = "Ejemplo de la galería: no se guardó nada.";
const PENDING_MS = 1500;

const OPTIONS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_atencion", label: "En atención" },
  { value: "reparada", label: "Reparada" },
  { value: "anulada", label: "Anulada" },
];

const CLOSED = ["reparada", "anulada"];

type RowStatusSelectDemoProps = {
  id: string;
  initialStatus: string;
  /** Simula que el servidor rechaza la operacion, para ver el error en la fila. */
  rejects?: boolean;
};

// Cambio de estado de la tabla de ejemplo (entrega 10.5b), como RowStatusDemo:
// la accion es una funcion del navegador que espera y responde como la del
// servidor, porque la galeria no ejecuta acciones de servidor. Con exito guarda
// el estado en la propia demo, que hace de lista que se vuelve a pintar.
export function RowStatusSelectDemo({ id, initialStatus, rejects = false }: RowStatusSelectDemoProps) {
  const [status, setStatus] = useState(initialStatus);

  async function demoAction(_prevState: RowStatusState, formData: FormData): Promise<RowStatusState> {
    await new Promise((resolve) => window.setTimeout(resolve, PENDING_MS));
    const values = { id };
    const requested = String(formData.get("estado") ?? "");

    if (rejects) {
      return {
        status: "error",
        error: "No se puede cambiar: el registro de ejemplo ya está cerrado.",
        values,
        operationId: crypto.randomUUID(),
      };
    }

    setStatus(requested);

    return { status: "success", data: { estado: requested }, values, operationId: crypto.randomUUID() };
  }

  if (CLOSED.includes(status)) {
    return <span className="text-xs text-muted-foreground">Sin accion</span>;
  }

  return (
    <RowStatusSelect
      action={demoAction}
      id={`estado-${id}`}
      fields={{ id }}
      name="estado"
      label={`Estado del registro de ejemplo ${id}`}
      value={status}
      options={OPTIONS}
      successNotification={{ type: "success", message: "Estado de ejemplo actualizado", description: DEMO_NOTE }}
      confirm={{
        reparada: {
          title: `¿Marcar como reparado el registro ${id}?`,
          description: "No se podrá cambiar su estado.",
          confirmText: "Marcar reparado",
          variant: "default",
        },
        anulada: {
          title: `¿Anular el registro ${id}?`,
          description: "No se podrá cambiar su estado. Se conserva en la lista.",
          confirmText: "Anular",
        },
      }}
    />
  );
}
