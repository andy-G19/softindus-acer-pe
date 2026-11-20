import * as React from "react"

import { fieldControlClassName, readOnlyFieldClassName } from "@/components/ui/field-control"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldControlClassName,
        readOnlyFieldClassName,
        "h-8 w-full min-w-0 rounded-lg px-2.5 py-1 text-base file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-placeholder disabled:pointer-events-none md:text-sm [&[type=number]]:tabular-nums",
        className
      )}
      {...props}
    />
  )
}

export { Input }
