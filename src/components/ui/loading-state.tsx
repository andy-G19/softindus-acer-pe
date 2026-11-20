import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type LoadingStateProps = {
  /** Que se esta cargando: "Cargando materiales...". */
  label?: string
  /** block: panel como EmptyState; inline: una linea dentro de otro elemento. */
  variant?: "block" | "inline"
  className?: string
}

// Estado de carga anunciado (entrega 8): role="status" hace que el lector de
// pantalla lea el texto sin mover el foco. En una pantalla de esqueletos se usa
// con className="sr-only": se anuncia la carga y se ven los bloques.
function LoadingState({ label = "Cargando...", variant = "block", className }: LoadingStateProps) {
  return (
    <div
      role="status"
      data-slot="loading-state"
      className={cn(
        // Diseno de mensajes y estados: el bloque es una tarjeta con borde continuo (el
        // discontinuo es del vacio), radio de 14 px y texto de 13 px.
        variant === "block"
          ? "flex flex-col items-center justify-center gap-2.5 rounded-xl border border-border bg-card px-5 py-9 text-center text-[0.8125rem] text-muted-foreground"
          : "inline-flex items-center gap-2 text-[0.8125rem] text-muted-foreground",
        className
      )}
    >
      <Spinner className={variant === "block" ? "size-[22px]" : "size-4"} />
      <span>{label}</span>
    </div>
  )
}

export { LoadingState }
