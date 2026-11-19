import type { FieldErrors } from "@/lib/errors";

/**
 * Resultado de una Server Action usada con useActionState que no redirige
 * (entrega 9, seccion 8 del plan): el formulario decide que hacer con el.
 *
 * - error: mensaje general, errores por campo y los valores enviados, que el
 *   formulario vuelve a mostrar (React 19 reinicia los campos al terminar la
 *   accion, ver ActionForm);
 * - success: los datos minimos de lo guardado y tambien los valores enviados;
 * - operationId: distinto en cada respuesta. ActionForm remonta los campos
 *   con el, y sirve para dar un solo aviso por operacion sin ocultar dos
 *   operaciones iguales seguidas.
 *
 * Es la unica forma de estado de formulario: sucedio a ActionErrorState, que
 * se retiro al cerrar la entrega 11, cuando ya ningun formulario la usaba.
 */
export type FormActionState<Values, Data> =
  | { status: "idle" }
  | { status: "error"; error: string; fieldErrors?: FieldErrors; values: Values; operationId: string }
  | { status: "success"; data: Data; values: Values; operationId: string };

export function newOperationId() {
  return crypto.randomUUID();
}
