import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "input-forge-focus flex field-sizing-content min-h-16 w-full rounded-lg border border-border bg-transparent px-2.5 py-2 text-base text-foreground transition-[color,background-color,border-color,box-shadow] duration-(--motion-fast) outline-none placeholder:text-placeholder disabled:cursor-not-allowed disabled:bg-input/50 disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&[readonly]]:cursor-default [&[readonly]]:bg-muted dark:[&[readonly]]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
