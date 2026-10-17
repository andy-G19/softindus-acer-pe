"use client";

import { useRef, useState, type ReactElement, type ReactNode } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Quien la abre: su propio disparador o, en modo controlado (entrega 9), el
// componente que la usa, por ejemplo al intentar cerrar un formulario con
// cambios. Los tipos impiden mezclar los dos modos.
type ConfirmDialogOpenProps =
  | {
      /** Boton que abre la confirmacion. */
      trigger: ReactElement;
      open?: never;
      onOpenChange?: never;
      closeOnConfirm?: never;
    }
  | {
      trigger?: never;
      /** Modo controlado: abierta o cerrada desde fuera, sin disparador. */
      open: boolean;
      /** Recibe false al cancelar, con Esc y cuando termina la accion. */
      onOpenChange: (open: boolean) => void;
      /**
       * Con false, confirmar no la cierra: la cierra quien la controla cuando
       * llega el resultado (por ejemplo, una accion en startTransition con su
       * pendiente externo). Por defecto se cierra al terminar onConfirm.
       */
      closeOnConfirm?: boolean;
    };

type ConfirmDialogProps = ConfirmDialogOpenProps & {
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
  /** Estado pendiente de una accion externa (por ejemplo, isPending de useTransition). */
  pending?: boolean;
  pendingText?: string;
  /** Mensaje de una accion que fallo: se muestra dentro de la ventana, que sigue abierta. */
  error?: ReactNode;
};

// Confirmacion accesible (entrega 8), sucesora de showConfirm y
// ConfirmDeleteButton (que siguen con SweetAlert2 hasta la entrega 11). Los
// tipos exigen la entidad, la consecuencia y el verbo: no hay confirmaciones
// genericas. Mientras esta pendiente no se puede cancelar ni cerrar con Esc.
// Si onConfirm falla, la ventana queda abierta y el error sigue su curso.
export function ConfirmDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText = "Cancelar",
  variant = "default",
  onConfirm,
  pending = false,
  pendingText,
  error,
  closeOnConfirm = true,
}: ConfirmDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : uncontrolledOpen;
  // Al cerrar, Radix devuelve el foco a su disparador; sin disparador lo
  // perderia (iria a body). En modo controlado se devuelve al elemento que
  // tenia el foco al abrir.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const busy = pending || running;
  const destructive = variant === "destructive";

  async function confirm() {
    setRunning(true);
    try {
      await onConfirm();
      if (closeOnConfirm) {
        setOpen(false);
      }
    } finally {
      setRunning(false);
    }
  }

  function setOpen(next: boolean) {
    if (controlled) {
      onOpenChange?.(next);
    } else {
      setUncontrolledOpen(next);
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
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent
        onOpenAutoFocus={() => {
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          if (controlled) {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }
        }}
      >
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
        {error ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
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
