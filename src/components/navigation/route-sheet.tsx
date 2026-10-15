"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ConfirmDialog } from "@/components/notifications/confirm-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type RouteSheetControls = {
  /** Pide cerrar: con cambios pendientes, confirma el descarte antes de volver. */
  requestClose: () => void;
  /** Cierra tras guardar, sin confirmar, y refresca la lista al volver. */
  closeAfterSave: () => void;
  /** Mientras es true (una accion pendiente), el panel no se cierra. */
  setBusy: (busy: boolean) => void;
};

const RouteSheetContext = createContext<RouteSheetControls | null>(null);

/** Controles del panel que contiene al componente, o null si no esta en un panel. */
export function useRouteSheet() {
  return useContext(RouteSheetContext);
}

type RouteSheetProps = {
  title: string;
  description?: string;
  /** Pregunta y consecuencia de la confirmacion de descarte. */
  discardTitle: string;
  discardDescription: string;
  className?: string;
  children: ReactNode;
};

// Panel lateral de una ruta interceptada (entrega 9): la navegacion desde el
// listado lo monta abierto sobre la lista, y cerrarlo es volver atras en el
// historial, asi que Atras lo cierra y Adelante lo reabre. Una recarga o la
// URL directa muestran la pagina completa del mismo formulario.
// - Cualquier cambio en sus campos (evento input) deja cambios pendientes:
//   cerrar (X, Esc, el velo o Cancelar) pide confirmar el descarte, y recargar
//   o salir de la pagina lo pregunta el navegador. Atras del navegador no se
//   puede interceptar: cierra sin preguntar (limitacion documentada).
// - Tras guardar cierra sin preguntar y, al volver, refresca la lista: Next
//   reutiliza las paginas al ir atras y podria mostrarla sin el cambio.
// - Sin disparador, Radix mandaria el foco a body al cerrar: se devuelve al
//   enlace que lo abrio (el elemento enfocado cuando se monto).
export function RouteSheet({ title, description, discardTitle, discardDescription, className, children }: RouteSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busyRef = useRef(false);
  // Los controles leen dirty de una ref para ser estables: si cambiaran con
  // dirty, el efecto de exito de un formulario que los usa se repetiria al
  // guardar (closeAfterSave limpia dirty) y daria dos avisos y dos back().
  const dirtyRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function markDirty(next: boolean) {
    dirtyRef.current = next;
    setDirty(next);
  }

  const controls = useMemo<RouteSheetControls>(() => {
    function leave() {
      setOpen(false);
      router.back();
    }

    return {
      requestClose() {
        if (busyRef.current) {
          return;
        }
        if (dirtyRef.current) {
          setConfirmOpen(true);
          return;
        }
        leave();
      },
      closeAfterSave() {
        window.addEventListener("popstate", () => router.refresh(), { once: true });
        dirtyRef.current = false;
        setDirty(false);
        leave();
      },
      setBusy(busy) {
        busyRef.current = busy;
      },
    };
  }, [router]);

  function discard() {
    markDirty(false);
    setOpen(false);
    router.back();
  }

  return (
    <RouteSheetContext.Provider value={controls}>
      <Sheet open={open} onOpenChange={(next) => (next ? undefined : controls.requestClose())}>
        <SheetContent
          className={cn("sm:max-w-xl", className)}
          // Sin descripcion, aria-describedby={undefined} le dice a Radix que es a
          // proposito; con ella, Radix la asocia solo y no hay que pisarla.
          {...(description ? {} : { "aria-describedby": undefined })}
          onInput={() => markDirty(true)}
          onOpenAutoFocus={() => {
            returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        variant="destructive"
        title={discardTitle}
        description={discardDescription}
        confirmText="Descartar cambios"
        onConfirm={discard}
      />
    </RouteSheetContext.Provider>
  );
}
