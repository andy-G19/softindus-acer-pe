import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Dobles de react-toastify para caracterizar las notificaciones
// (entrega 7). Registran en orden cada llamada a la libreria, que es la
// frontera con lo que ve el usuario: lo que haya entre un componente y la
// libreria se puede reorganizar sin que cambie el registro. El contenido de un
// toast se guarda como el HTML que renderiza, con sus clases.

type ToastType = "success" | "error" | "warning" | "info";

export type NotificationCall =
  | { toast: ToastType; html: string; options: unknown }
  | { effect: string };

const state = {
  calls: [] as NotificationCall[],
};

export function resetNotificationDoubles() {
  state.calls.length = 0;
}

// Devuelve las llamadas registradas desde la ultima lectura.
export function takeNotificationCalls() {
  return state.calls.splice(0);
}

// Registra un efecto ajeno a las librerias (por ejemplo, enviar el formulario)
// en el mismo orden que las llamadas.
export function recordNotificationEffect(effect: string) {
  state.calls.push({ effect });
}

function recordToast(type: ToastType) {
  return (content: ReactElement, options: unknown) => {
    state.calls.push({ toast: type, html: renderToStaticMarkup(content), options });
  };
}

export function toastifyModuleMock() {
  return {
    toast: {
      success: recordToast("success"),
      error: recordToast("error"),
      warning: recordToast("warning"),
      info: recordToast("info"),
    },
  };
}
