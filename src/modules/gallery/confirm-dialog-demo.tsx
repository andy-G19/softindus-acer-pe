"use client";

import { ConfirmDialog } from "@/components/notifications/confirm-dialog";
import { Button } from "@/components/ui/button";
import { showInfo } from "@/lib/notifications";

const DEMO_NOTE = "Ejemplo de la galería: no se guardó nada.";
const PENDING_MS = 1500;

function simulateAction() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, PENDING_MS));
}

// Confirmaciones accesibles sobre Radix, junto a las de SweetAlert2 para
// compararlas. Confirmar solo espera 1,5 s en el navegador: no llama al
// servidor.
export function ConfirmDialogDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ConfirmDialog
        trigger={
          <Button type="button" variant="secondary">
            Confirmación accesible
          </Button>
        }
        title="¿Cerrar la orden de trabajo OTR00000099?"
        description="La orden pasará a cerrada y ya no admitirá avances ni consumos de material. Es un ejemplo: no se cierra nada."
        confirmText="Cerrar orden"
        pendingText="Cerrando..."
        onConfirm={async () => {
          await simulateAction();
          showInfo("Confirmaste el cierre", DEMO_NOTE);
        }}
      />
      <ConfirmDialog
        variant="destructive"
        trigger={
          <Button type="button" variant="destructive">
            Anulación accesible
          </Button>
        }
        title="¿Anular el pedido PED00000099?"
        description="El pedido pasará a anulado y se liberará el stock reservado. No se puede deshacer. Es un ejemplo: no se anula nada."
        confirmText="Anular pedido"
        pendingText="Anulando..."
        onConfirm={async () => {
          await simulateAction();
          showInfo("Confirmaste la anulación", DEMO_NOTE);
        }}
      />
    </div>
  );
}
