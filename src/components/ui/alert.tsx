import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Alertas (propuesta del responsable, 2026-11-19): un color por significado, con su superficie,
// su borde y su texto (cierra D101: antes todas tenian el borde gris comun y sus colores vivian en
// patterns.css). El icono y el titulo toman el color del significado; el texto queda atenuado.
const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-4 py-3.5 text-left text-sm text-foreground has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg]:translate-y-px *:[svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "border-border bg-accent",
        destructive:
          "border-destructive-border bg-destructive-surface *:[svg]:text-destructive-foreground *:data-[slot=alert-title]:text-destructive-foreground *:data-[slot=alert-description]:text-destructive-foreground/85",
        success:
          "border-success-border bg-success-surface *:[svg]:text-success-foreground *:data-[slot=alert-title]:text-success-foreground",
        warning:
          "border-warning-border bg-warning-surface *:[svg]:text-warning-foreground *:data-[slot=alert-title]:text-warning-foreground",
        info: "border-info-border bg-info-surface *:[svg]:text-info-foreground *:data-[slot=alert-title]:text-info-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "text-sm font-semibold group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-[0.8125rem] text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
