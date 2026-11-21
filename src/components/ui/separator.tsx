"use client"

import * as React from "react"
import { Separator as SeparatorPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Desde el diseno de la presentacion (propuesta del responsable, 2026-11-20; D158) un destello de
// acero recorre la linea horizontal y la vertical late (.separator-gleam de patterns.css, que
// lee el data-orientation de Radix); se detiene con reducir movimiento.
function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "separator-gleam relative shrink-0 overflow-hidden bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
