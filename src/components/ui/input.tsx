import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "input-forge-focus h-8 w-full min-w-0 rounded-lg border border-border bg-transparent px-2.5 py-1 text-base text-foreground transition-[color,background-color,border-color,box-shadow] duration-(--motion-fast) outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-placeholder focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&[readonly]]:cursor-default [&[readonly]]:bg-muted dark:[&[readonly]]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

export { Input }
