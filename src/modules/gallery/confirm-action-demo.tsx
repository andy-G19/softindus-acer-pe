"use client";

import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { FormActionState } from "@/lib/action-result";

const DEMO_NOTE = "Ejemplo de la galería: no se guardó nada.";
const PENDING_MS = 1500;

type DemoState = FormActionState<{ id: string }, { estado: boolean }>;

type RowStatusDemoProps = {
  id: string;
  name: string;
  active: boolean;
  /** Simula que el servidor rechaza la operacion, para ver el error dentro de la ventana. */
  rejects?: boolean;
};

// Activar e inactivar de la tabla de ejemplo (entrega 10). La accion es una
// funcion del navegador que espera y responde como lo haria la del servidor:
// la galeria no ejecuta acciones de servidor (gallery-page.test.ts) y un
// componente de servidor no puede pasarle una funcion a uno de cliente, asi
// que la demo vive aqui.
export function RowStatusDemo({ id, name, active, rejects = false }: RowStatusDemoProps) {
  async function demoAction(_prevState: DemoState, formData: FormData): Promise<DemoState> {
    await new Promise((resolve) => window.setTimeout(resolve, PENDING_MS));
    const values = { id: String(formData.get("id") ?? "") };

    if (rejects) {
      return {
        status: "error",
        error: "No se puede inactivar: el cliente de ejemplo tiene pedidos pendientes.",
        values,
        operationId: crypto.randomUUID(),
      };
    }

    return { status: "success", data: { estado: !active }, values, operationId: crypto.randomUUID() };
  }

  if (!active) {
    return (
      <ConfirmActionButton
        action={demoAction}
        fields={{ id }}
        variant="ghost"
        successNotification={{ type: "success", message: "Cliente de ejemplo activado", description: DEMO_NOTE }}
        pendingText="Activando..."
      >
        Activar
      </ConfirmActionButton>
    );
  }

  return (
    <ConfirmActionButton
      action={demoAction}
      fields={{ id }}
      variant="destructive"
      successNotification={{ type: "warning", message: "Cliente de ejemplo inactivado", description: DEMO_NOTE }}
      confirm={{
        title: `¿Inactivar el cliente ${name}?`,
        description: "Dejará de aparecer al registrar pedidos. Puedes volver a activarlo cuando quieras.",
        confirmText: "Inactivar cliente",
      }}
      pendingText="Inactivando..."
    >
      Inactivar
    </ConfirmActionButton>
  );
}
