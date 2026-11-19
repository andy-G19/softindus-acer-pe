import * as React from "react"
import { ChevronDown } from "lucide-react"

import { fieldControlClassName } from "@/components/ui/field-control"
import { cn } from "@/lib/utils"

// La flecha es un icono propio sobre el select (appearance-none): la del
// navegador no sigue el diseno, y una imagen de fondo no puede tomar el color
// de un token. Ninguna pantalla pasa className, asi que el contenedor ocupa el
// ancho que antes ocupaba el select.
function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div data-slot="native-select-wrapper" className="relative w-full min-w-0">
      <select
        data-slot="native-select"
        className={cn(
          fieldControlClassName,
          "h-8 w-full min-w-0 appearance-none rounded-lg py-1 pr-8 pl-2.5 text-base disabled:pointer-events-none md:text-sm [&_option]:bg-popover [&_option]:text-popover-foreground",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}

export { NativeSelect }
