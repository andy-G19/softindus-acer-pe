"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/notifications/confirm-dialog";
import type { FormActionState } from "@/lib/action-result";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import { notify } from "@/lib/notifications";

// Superficie de un formulario (entrega 10): la ventana que lo contiene, sea
// el panel lateral de una ruta interceptada (RouteSheet) o una ventana modal
// (FormDialog). El mismo formulario funciona en las dos y en una pagina
// completa: lee los controles con useFormSurface, que en la pagina devuelve
// null. El descarte de cambios y la guarda de ocupado estaban copiados en el
// panel, en la ventana de categorias de producto y en la demo de la galeria;
// ahora viven en useDiscardGuard.

/** Controles de la ventana que contiene un formulario. */
export type FormSurfaceControls = {
  /** Pide cerrar: con cambios pendientes, confirma el descarte antes de salir. */
  requestClose: () => void;
  /** Cierra tras guardar, sin confirmar aunque haya cambios. */
  closeAfterSave: () => void;
  /** Mientras es true (una accion pendiente), la ventana no se cierra. */
  setBusy: (busy: boolean) => void;
};

const FormSurfaceContext = createContext<FormSurfaceControls | null>(null);

/** Lo usan RouteSheet y FormDialog para dar sus controles al formulario. */
export const FormSurfaceProvider = FormSurfaceContext.Provider;

/** Controles de la ventana que contiene al formulario, o null en una pagina completa. */
export function useFormSurface() {
  return useContext(FormSurfaceContext);
}

/** Por que se sale de la ventana: tras guardar o al cerrarla sin cambios o descartandolos. */
export type SurfaceLeaveReason = "saved" | "closed";

type DiscardGuardOptions = {
  /** Cierra la ventana sin preguntar. */
  onLeave: (reason: SurfaceLeaveReason) => void;
  /** Con cambios, recargar o salir de la pagina lo pregunta el navegador. */
  warnOnUnload: boolean;
};

/**
 * Cambios pendientes y guarda de ocupado de una ventana con formulario.
 * La ventana llama a markDirty(true) en cada evento input y a
 * controls.requestClose() cuando se intenta cerrar (X, Esc, el velo o
 * Cancelar); pinta DiscardConfirmDialog con discardDialog.
 */
export function useDiscardGuard({ onLeave, warnOnUnload }: DiscardGuardOptions) {
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Los controles leen refs para ser estables: si cambiaran con dirty, el
  // efecto de exito de un formulario que los usa se repetiria al guardar
  // (closeAfterSave limpia dirty) y daria dos avisos y dos cierres.
  const dirtyRef = useRef(false);
  const busyRef = useRef(false);
  const onLeaveRef = useRef(onLeave);

  useEffect(() => {
    onLeaveRef.current = onLeave;
  }, [onLeave]);

  useEffect(() => {
    if (!warnOnUnload || !dirty) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, warnOnUnload]);

  const markDirty = useCallback((next: boolean) => {
    dirtyRef.current = next;
    setDirty(next);
  }, []);

  const controls = useMemo<FormSurfaceControls>(
    () => ({
      requestClose() {
        if (busyRef.current) {
          return;
        }
        if (dirtyRef.current) {
          setConfirmOpen(true);
          return;
        }
        onLeaveRef.current("closed");
      },
      closeAfterSave() {
        markDirty(false);
        onLeaveRef.current("saved");
      },
      setBusy(busy) {
        busyRef.current = busy;
      },
    }),
    [markDirty],
  );

  function discard() {
    markDirty(false);
    onLeaveRef.current("closed");
  }

  return {
    controls,
    markDirty,
    discardDialog: { open: confirmOpen, onOpenChange: setConfirmOpen, onConfirm: discard },
  };
}

type DiscardConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** Pregunta con la entidad: "¿Descartar el cliente nuevo?". */
  title: string;
  /** Consecuencia: que se pierde. */
  description: string;
};

/** Confirmacion de descarte de una ventana con formulario (controlada, sin disparador). */
export function DiscardConfirmDialog({ open, onOpenChange, onConfirm, title, description }: DiscardConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      variant="destructive"
      title={title}
      description={description}
      confirmText="Descartar cambios"
      onConfirm={onConfirm}
    />
  );
}

type FormResultOptions = {
  /** Aviso del catalogo del area; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
  /** En una pagina completa (sin ventana), que hacer tras guardar; por ejemplo, volver al returnTo. */
  onSuccess?: () => void;
};

/**
 * Efectos del resultado de un formulario con FormActionState: informa a la
 * ventana si la accion esta pendiente y, con exito, da un solo aviso y cierra
 * la ventana (o llama a onSuccess en la pagina completa). Cada respuesta de la
 * accion es un estado nuevo, asi que el aviso sale una vez por operacion; el
 * aviso y onSuccess se leen de una ref para que cambiarlos no lo repita.
 */
export function useFormResult(
  state: FormActionState<unknown, unknown>,
  pending: boolean,
  { successNotification, onSuccess }: FormResultOptions,
) {
  const surface = useFormSurface();
  const latest = useRef({ successNotification, onSuccess });

  useEffect(() => {
    latest.current = { successNotification, onSuccess };
  }, [successNotification, onSuccess]);

  useEffect(() => {
    surface?.setBusy(pending);
  }, [surface, pending]);

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    notify(latest.current.successNotification);

    if (surface) {
      surface.closeAfterSave();
    } else {
      latest.current.onSuccess?.();
    }
  }, [state, surface]);
}
