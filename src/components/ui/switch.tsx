"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Interruptor (propuesta del responsable, 2026-11-19): pista de 44 x 24 px con
// borde de acero, encendido en verde forja (el naranja queda para la accion
// principal), pulgar claro de 18 px que recorre 20 px y foco con el anillo y
// el hueco de los botones.
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-control-border outline-none",
        "transition-[background-color,border-color,box-shadow] duration-(--motion-base) ease-(--ease-settle) motion-reduce:transition-none",
        "data-[state=checked]:border-accent-forge data-[state=checked]:bg-accent-forge data-[state=unchecked]:bg-muted",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:border-border disabled:opacity-55",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4.5 rounded-full bg-foreground shadow-thumb ring-0",
          "transition-[translate] duration-(--motion-base) ease-(--ease-settle) motion-reduce:transition-none",
          "data-[state=checked]:translate-x-5.5 data-[state=unchecked]:translate-x-0.5",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
