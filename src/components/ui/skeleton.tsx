import * as React from "react"

import { cn } from "@/lib/utils"

// Bloque de carga (entrega 8): las mismas clases que los bloques de
// production/loading.tsx. Es decorativo: el lector de pantalla oye el
// LoadingState de la pantalla, no cada bloque. El pulso se detiene con
// prefers-reduced-motion.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-muted motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Skeleton }
