"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  /** Boton que abre la confirmacion. */
  trigger: ReactElement;
  /** Pregunta con la entidad: "¿Anular el pedido PED00000012?". */
  title: string;
  /** Consecuencia: que pasa y si se puede deshacer. */
  description: ReactNode;
  /** Verbo concreto de la accion ("Anular pedido"); no hay "Confirmar" por defecto. */
  confirmText: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  /** Si devuelve una promesa, la ventana espera con el boton pendiente y se cierra al terminar. */
  onConfirm: () => void | Promise<void>;
  /** Estado pendiente de una accion externa (por ejemplo, isPending de useActionState). */
  pending?: boolean;
  pendingText?: string;
};

// Confirmacion accesible (entrega 8), sucesora de showConfirm y
// ConfirmDeleteButton (que siguen con SweetAlert2 hasta la entrega 11). Los
// tipos exigen la entidad, la consecuencia y el verbo: no hay confirmaciones
// genericas. Mientras esta pendiente no se puede cancelar ni cerrar con Esc.
// Si onConfirm falla, la ventana queda abierta y el error sigue su curso.
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmText,
  cancelText = "Cancelar",
  variant = "default",
  onConfirm,
  pending = false,
  pendingText,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const busy = pending || running;
  const destructive = variant === "destructive";

  async function confirm() {
    setRunning(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setRunning(false);
    }
  }

  // Esc y Cancelar piden cerrar por aqui: mientras esta pendiente se ignora.
  function changeOpen(next: boolean) {
    if (!busy) {
      setOpen(next);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader className="items-center sm:flex-row sm:items-start sm:gap-4">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              destructive ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning",
            )}
          >
            <TriangleAlert className="size-5" aria-hidden="true" />
          </span>
          <div className="space-y-2">
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" disabled={busy}>
              {cancelText}
            </Button>
          </AlertDialogCancel>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            pending={busy}
            pendingText={pendingText}
            onClick={confirm}
          >
            {confirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
