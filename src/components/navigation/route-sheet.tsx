"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import {
  DiscardConfirmDialog,
  FormSurfaceProvider,
  useDiscardGuard,
  type SurfaceLeaveReason,
} from "@/components/forms/form-surface";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

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
// URL directa muestran la pagina completa del mismo formulario, que lee los
// controles del panel con useFormSurface.
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
  const returnFocusRef = useRef<HTMLElement | null>(null);

  function leave(reason: SurfaceLeaveReason) {
    if (reason === "saved") {
      window.addEventListener("popstate", () => router.refresh(), { once: true });
    }
    setOpen(false);
    router.back();
  }

  const { controls, markDirty, trackFocus, ignoreConfirmationPointer, discardDialog } = useDiscardGuard({
    onLeave: leave,
  });

  return (
    <FormSurfaceProvider value={controls}>
      <Sheet open={open} onOpenChange={(next) => (next ? undefined : controls.requestClose())}>
        <SheetContent
          className={cn("sm:max-w-xl", className)}
          // Sin descripcion, aria-describedby={undefined} le dice a Radix que es a
          // proposito; con ella, Radix la asocia solo y no hay que pisarla.
          {...(description ? {} : { "aria-describedby": undefined })}
          onInput={() => markDirty(true)}
          onFocus={trackFocus}
          onPointerDownOutside={ignoreConfirmationPointer}
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
      <DiscardConfirmDialog {...discardDialog} title={discardTitle} description={discardDescription} />
    </FormSurfaceProvider>
  );
}
