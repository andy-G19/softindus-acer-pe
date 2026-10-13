"use client";

import { Button } from "@/components/ui/button";
import {
  closeModal,
  showConfirm,
  showDeleteConfirm,
  showError,
  showInfo,
  showLoading,
  showSuccess,
  showWarning,
} from "@/lib/notifications";

const DEMO_NOTE = "Ejemplo de la galería: no se guardó nada.";
const LOADING_MS = 1500;

// Abre los avisos y confirmaciones reales de la fachada de notificaciones, solo
// en el navegador: ningun boton llama al servidor.
export function FeedbackDemo() {
  async function confirmDemo() {
    const confirmed = await showConfirm({
      title: "¿Cerrar la orden de trabajo de ejemplo?",
      text: "La orden pasará a cerrada. Es un ejemplo: no se cierra nada.",
      confirmText: "Cerrar orden",
    });

    showInfo(confirmed ? "Confirmaste la acción" : "Cancelaste la acción", DEMO_NOTE);
  }

  async function deleteDemo() {
    const confirmed = await showDeleteConfirm("el registro de ejemplo");

    showInfo(confirmed ? "Confirmaste la eliminación" : "Cancelaste la eliminación", DEMO_NOTE);
  }

  function loadingDemo() {
    showLoading();
    window.setTimeout(closeModal, LOADING_MS);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" onClick={() => showSuccess("Cliente guardado correctamente", DEMO_NOTE)}>
        Aviso de éxito
      </Button>
      <Button type="button" variant="outline" onClick={() => showError("No se pudo guardar el cliente", DEMO_NOTE)}>
        Aviso de error
      </Button>
      <Button type="button" variant="outline" onClick={() => showWarning("Stock por debajo del mínimo", DEMO_NOTE)}>
        Aviso de advertencia
      </Button>
      <Button type="button" variant="outline" onClick={() => showInfo("Pedido sin comprobante", DEMO_NOTE)}>
        Aviso de información
      </Button>
      <Button type="button" variant="secondary" onClick={confirmDemo}>
        Confirmación
      </Button>
      <Button type="button" variant="destructive" onClick={deleteDemo}>
        Confirmación de eliminación
      </Button>
      <Button type="button" variant="secondary" onClick={loadingDemo}>
        Ventana de carga (1,5 s)
      </Button>
    </div>
  );
}
