"use client";

import { useCallback, useState, type ReactElement, type ReactNode } from "react";

import { DiscardConfirmDialog, FormSurfaceProvider, useDiscardGuard } from "@/components/forms/form-surface";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type FormDialogProps = {
  /** Boton que abre la ventana (Radix le devuelve el foco al cerrarla). */
  trigger: ReactElement;
  title: string;
  /** Sin descripcion, la ventana se nombra solo con el titulo. */
  description?: string;
  /** Pregunta y consecuencia de la confirmacion de descarte. */
  discardTitle: string;
  discardDescription: string;
  /** El formulario: lee los controles con useFormSurface y pinta DialogBody y DialogFooter. */
  children: ReactNode;
};

// Ventana modal con un formulario (entrega 10), sin URL: la variante de los
// catalogos breves que probo la entrega 9 con las categorias de producto. La
// abre su boton y, al cerrarla, Radix devuelve el foco a ese boton. El
// formulario se monta cada vez que se abre, asi que empieza sin estado.
// - Escribir deja cambios pendientes: cerrar (Cancelar, X, Esc o el velo) pide
//   confirmar el descarte, y recargar o salir de la pagina lo pregunta el
//   navegador, como en el panel lateral.
// - Mientras la accion esta pendiente no se cierra.
// - Tras guardar se cierra sin preguntar; la lista se actualiza por el
//   revalidatePath de la accion.
export function FormDialog({ trigger, title, description, discardTitle, discardDescription, children }: FormDialogProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { controls, markDirty, trackFocus, discardDialog } = useDiscardGuard({ onLeave: close });

  function changeOpen(next: boolean) {
    if (next) {
      markDirty(false);
      setOpen(true);
    } else {
      controls.requestClose();
    }
  }

  return (
    <FormSurfaceProvider value={controls}>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent
          // Sin descripcion, aria-describedby={undefined} le dice a Radix que es a
          // proposito; con ella, Radix la asocia solo y no hay que pisarla.
          {...(description ? {} : { "aria-describedby": undefined })}
          onInput={() => markDirty(true)}
          onFocus={trackFocus}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
      <DiscardConfirmDialog {...discardDialog} title={discardTitle} description={discardDescription} />
    </FormSurfaceProvider>
  );
}
