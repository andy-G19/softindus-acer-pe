"use client";

import { Button } from "@/components/ui/button";
import { showError, showInfo, showSuccess, showWarning } from "@/lib/notifications";

const DEMO_NOTE = "Ejemplo de la galería: no se guardó nada.";

// Abre los avisos reales de la fachada de notificaciones, solo en el navegador:
// ningun boton llama al servidor. Las confirmaciones y la ventana de carga de
// SweetAlert2 se retiraron en la 11.7a (D86); las confirmaciones estan en la
// demo de ConfirmDialog.
export function FeedbackDemo() {
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
    </div>
  );
}
