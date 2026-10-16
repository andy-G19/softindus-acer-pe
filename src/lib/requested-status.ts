import { newOperationId, type FormActionState } from "@/lib/action-result";

// Estado pedido al activar o inactivar un registro (entrega 10, decision A de
// la 10.1). El boton envia el estado que quiere dejar ("true" o "false") en
// lugar de pedir "el contrario del actual": asi el servidor puede fijarlo con
// una sola sentencia que compara y escribe (updateMany con el estado opuesto
// en el where) y una lista desactualizada o un doble clic nunca hacen lo
// contrario de lo que dice el boton.

/** "true" o "false" del formulario; cualquier otro valor (o ninguno) es null. */
export function parseRequestedStatus(value: FormDataEntryValue | null): boolean | null {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

/**
 * Resultado de activar o inactivar desde la fila (ConfirmActionButton): el id
 * enviado y, con exito, el estado que quedo.
 */
export type StatusToggleState = FormActionState<{ id: string }, { estado: boolean }>;

export function statusToggleError(id: string, error: string): StatusToggleState {
  return { status: "error", error, values: { id }, operationId: newOperationId() };
}

export function statusToggleDone(id: string, estado: boolean): StatusToggleState {
  return { status: "success", data: { estado }, values: { id }, operationId: newOperationId() };
}
