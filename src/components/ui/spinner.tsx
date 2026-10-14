import * as React from "react"
import { LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"

// Indicador de carga (entrega 8). Es decorativo: lo oculta a los lectores de
// pantalla y el estado lo anuncia quien lo usa (el boton pendiente con
// aria-busy y su texto). Gira mientras algo esta en curso y se detiene con
// prefers-reduced-motion. No fija su tamano: dentro de un boton lo decide el
// tamano del boton, como con cualquier otro icono.
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <LoaderCircle
      data-slot="spinner"
      aria-hidden="true"
      className={cn("animate-spin motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Spinner }
