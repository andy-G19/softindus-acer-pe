"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import {
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
  dialogMotionClasses,
  dialogSurfaceClasses,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// Panel lateral (entrega 8): el mismo Dialog de Radix anclado a un lado. Solo
// cambian la raiz y el contenido; encabezado, cuerpo, pie, titulo, descripcion
// y cierre son las piezas de Dialog, con nombre Sheet*. En movil ocupa la
// pantalla completa; desde sm mide max-w-md y entra desde su lado.

const sideClasses = {
  right:
    "right-0 sm:border-l data-open:slide-in-from-right data-closed:slide-out-to-right",
  left: "left-0 sm:border-r data-open:slide-in-from-left data-closed:slide-out-to-left",
} as const

function Sheet(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

type SheetContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  side?: keyof typeof sideClasses
  showCloseButton?: boolean
}

function SheetContent({ className, children, side = "right", showCloseButton = true, ...props }: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          dialogSurfaceClasses,
          "inset-y-0 h-dvh w-full sm:max-w-md sm:border-border sm:shadow-dialog data-open:animate-in data-closed:animate-out",
          sideClasses[side],
          dialogMotionClasses,
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

export {
  Sheet,
  DialogBody as SheetBody,
  DialogClose as SheetClose,
  SheetContent,
  DialogDescription as SheetDescription,
  DialogFooter as SheetFooter,
  DialogHeader as SheetHeader,
  DialogTitle as SheetTitle,
  DialogTrigger as SheetTrigger,
}
