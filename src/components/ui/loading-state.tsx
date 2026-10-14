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
        variant === "block"
          ? "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/80 bg-secondary/45 px-4 py-6 text-center text-sm text-muted-foreground"
          : "inline-flex items-center gap-2 text-sm text-muted-foreground",
        className
      )}
    >
      <Spinner className={variant === "block" ? "size-5" : "size-4"} />
      <span>{label}</span>
    </div>
  )
}

export { LoadingState }
