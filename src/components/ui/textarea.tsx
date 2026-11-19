import * as React from "react"

import { fieldControlClassName, readOnlyFieldClassName } from "@/components/ui/field-control"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldControlClassName,
        readOnlyFieldClassName,
        "flex field-sizing-content min-h-16 w-full resize-y rounded-lg px-2.5 py-2 text-base placeholder:text-placeholder md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
