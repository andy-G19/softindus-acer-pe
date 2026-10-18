"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FocusEvent } from "react";

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
};

/**
 * Cambios pendientes y guarda de ocupado de una ventana con formulario.
 * La ventana llama a markDirty(true) en cada evento input, a trackFocus en el
 * onFocus de su contenido y a controls.requestClose() cuando se intenta
 * cerrar (X, Esc, el velo o Cancelar); pinta DiscardConfirmDialog con
 * discardDialog. Con cambios, recargar o salir de la pagina lo pregunta el
 * navegador (beforeunload).
 */
export function useDiscardGuard({ onLeave }: DiscardGuardOptions) {
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Los controles leen refs para ser estables: si cambiaran con dirty, el
  // efecto de exito de un formulario que los usa se repetiria al guardar
  // (closeAfterSave limpia dirty) y daria dos avisos y dos cierres.
  const dirtyRef = useRef(false);
  const busyRef = useRef(false);
  const onLeaveRef = useRef(onLeave);
  // La ventana y el ultimo elemento que tuvo el foco dentro de ella. Un clic
  // fuera deja el foco en body antes de que Radix cierre (en el click), y
  // Safari no enfoca el boton Cancelar al pulsarlo: el foco que habia al
  // abrir la confirmacion no dice donde estaba el usuario (hallazgo 8 de la
  // 10.1). El onFocus de React se propaga como focusin, y la confirmacion es
  // hermana de la ventana en el arbol de React, asi que no cuenta.
  const surfaceRef = useRef<HTMLElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onLeaveRef.current = onLeave;
  }, [onLeave]);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

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

  const trackFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    surfaceRef.current = event.currentTarget;
    if (event.target instanceof HTMLElement) {
      lastFocusRef.current = event.target;
    }
  }, []);

  // Cancelar el descarte vuelve al ultimo elemento enfocado de la ventana; si
  // ya no esta en ella (por ejemplo, ActionForm remonto los campos), a la
  // ventana misma, como hace Radix cuando desaparece el elemento enfocado.
  const returnFocusTo = useCallback(() => {
    const surface = surfaceRef.current;
    const last = lastFocusRef.current;
    return last && surface?.contains(last) ? last : surface;
  }, []);

  function discard() {
    markDirty(false);
    onLeaveRef.current("closed");
  }

  return {
    controls,
    markDirty,
    trackFocus,
    discardDialog: { open: confirmOpen, onOpenChange: setConfirmOpen, onConfirm: discard, returnFocusTo },
  };
}

type DiscardConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** A donde vuelve el foco al cancelar: lo da useDiscardGuard. */
  returnFocusTo: () => HTMLElement | null;
  /** Pregunta con la entidad: "¿Descartar el cliente nuevo?". */
  title: string;
  /** Consecuencia: que se pierde. */
  description: string;
};

/** Confirmacion de descarte de una ventana con formulario (controlada, sin disparador). */
export function DiscardConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  returnFocusTo,
  title,
  description,
}: DiscardConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      returnFocusTo={returnFocusTo}
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
