"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Ventana (entrega 8) sobre el Dialog de Radix: atrapa el foco, lo pone en el
// primer elemento enfocable al abrir, cierra con Esc o con el velo y lo
// devuelve al boton que la abrio. Encabezado y pie fijos; solo el cuerpo se
// desplaza. En movil ocupa la pantalla completa; desde sm es una ventana
// centrada con el aspecto de las confirmaciones (AlertDialog).
//
// Un formulario en la ventana envuelve el cuerpo y el pie:
//   <form className="flex min-h-0 flex-1 flex-col"><DialogBody/><DialogFooter/></form>
// asi el boton de envio queda dentro del <form> y SubmitButton (useFormStatus)
// funciona. Sin descripcion, se pasa aria-describedby={undefined} al contenido.
//
// Las animaciones de tw-animate-css no miran prefers-reduced-motion y sus
// variantes data-open/data-closed van despues de motion-reduce en el CSS: por
// eso motion-reduce:animate-none lleva !important (igual que en AlertDialog).

const motionClasses = "duration-(--motion-base) motion-reduce:animate-none!"

// Comun a Dialog y Sheet: columna con encabezado, cuerpo y pie.
const surfaceClasses =
  "fixed z-(--z-overlay) flex flex-col bg-linear-to-b from-card to-popover text-foreground outline-none"

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-(--z-overlay) bg-overlay data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        motionClasses,
        className
      )}
      {...props}
    />
  )
}

// La X va al final del DOM: al abrir, el foco cae en el primer campo, no en
// "Cerrar". Es de solo icono, asi que los tipos de Button exigen su aria-label.
function DialogCloseButton() {
  return (
    <DialogPrimitive.Close asChild>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Cerrar" className="absolute top-3 right-3">
        <XIcon />
      </Button>
    </DialogPrimitive.Close>
  )
}

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}

function DialogContent({ className, children, showCloseButton = true, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          surfaceClasses,
          "inset-0 h-dvh w-full sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[calc(100dvh-4rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:border-border sm:shadow-dialog data-open:animate-in data-open:fade-in-0 sm:data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 sm:data-closed:zoom-out-95",
          motionClasses,
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton ? <DialogCloseButton /> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex shrink-0 flex-col gap-1.5 border-b border-border/80 px-6 py-4 pr-14 text-left", className)}
      {...props}
    />
  )
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-4", className)}
      {...props}
    />
  )
}

// En movil los botones se apilan con la accion arriba y el pie respeta la zona
// segura inferior del telefono; el orden del DOM (y del Tab) no cambia.
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 border-t border-border/80 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:pb-4",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading text-lg font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
  motionClasses as dialogMotionClasses,
  surfaceClasses as dialogSurfaceClasses,
}
