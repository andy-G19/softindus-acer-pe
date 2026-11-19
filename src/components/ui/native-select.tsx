import * as React from "react"

import { cn } from "@/lib/utils"

function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "input-forge-focus h-8 w-full min-w-0 rounded-lg border border-border bg-transparent px-2.5 py-1 text-base text-foreground transition-[color,background-color,border-color,box-shadow] duration-(--motion-fast) outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-muted-foreground md:text-sm dark:bg-input/30 dark:disabled:bg-muted [&_option]:bg-popover [&_option]:text-popover-foreground aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export { NativeSelect }
