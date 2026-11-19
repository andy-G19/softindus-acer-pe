"use client"

import * as React from "react"
import { Paperclip } from "lucide-react"

import { cn } from "@/lib/utils"

const EMPTY_TEXT = "Ningún archivo seleccionado"

function selectedText(files: FileList | null) {
  if (!files?.length) return null
  return files.length === 1 ? files[0].name : `${files.length} archivos seleccionados`
}

/**
 * Campo de archivo (propuesta de los campos, 2026-11-19). El input real queda
 * oculto a la vista (sr-only), pero no al teclado ni al lector; la fila visible
 * es su etiqueta, con el aspecto de los demas campos, y muestra el foco, el
 * error y el deshabilitado del input con las variantes peer. Se usa dentro de
 * Field, que le da id, required, aria-invalid y aria-describedby.
 */
function FileInput({
  className,
  id,
  onChange,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { id: string }) {
  const [name, setName] = React.useState<string | null>(null)

  return (
    <div data-slot="file-input" className={cn("relative w-full min-w-0", className)}>
      <input
        id={id}
        type="file"
        className="peer sr-only"
        onChange={(event) => {
          setName(selectedText(event.target.files))
          onChange?.(event)
        }}
        {...props}
      />
      <label
        htmlFor={id}
        data-slot="file-input-row"
        className={cn(
          "flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-control-border bg-card bg-(image:--texture-metal) px-2.5 text-sm",
          "transition-[color,background-color,border-color,box-shadow] duration-(--motion-base) ease-out motion-reduce:transition-none",
          "hover:border-control-border-hover",
          "peer-focus-visible:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
          "peer-aria-invalid:border-destructive-outline peer-aria-invalid:peer-focus-visible:ring-destructive-outline",
          "peer-disabled:cursor-not-allowed peer-disabled:border-border peer-disabled:bg-muted peer-disabled:bg-none peer-disabled:opacity-65",
        )}
      >
        <Paperclip aria-hidden="true" className="size-4 shrink-0 text-accent-steel" />
        <span className={cn("truncate", name ? "text-foreground" : "text-muted-foreground")}>
          {name ?? EMPTY_TEXT}
        </span>
      </label>
    </div>
  )
}

export { FileInput }
