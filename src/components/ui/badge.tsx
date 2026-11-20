/**
 * Etiqueta compartida (shadcn). Desde el diseno de la presentacion (propuesta del responsable,
 * 2026-11-20; D153 y D154) es un rectangulo de 24 px con radio de 6 px, letra sans de 11 px en
 * negrita y mayusculas, y cada variante toma su color de un token de tokens.css: default es un
 * lingote cobre, secondary acero cepillado (antes se veia igual que info), success, warning,
 * info y destructive las superficies de las alertas, y outline, ghost y link acompanan texto
 * sin competir con el. Al pasar el puntero sube 3 px, crece al 105 % y se aclara (D154). En
 * reposo no se mueve (D153): success se asienta con un sello al montar y destructive sacude una
 * vez (.badge-settle y .badge-shake de patterns.css). Con reducir movimiento no hay transicion,
 * desplazamiento ni gesto.
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-2.5 font-sans text-[11px] font-bold uppercase tracking-[0.03em] whitespace-nowrap transition-[color,background-color,border-color,box-shadow,translate,scale,filter] duration-(--motion-base) ease-(--ease-spring) hover:-translate-y-[3px] hover:scale-105 hover:brightness-110 motion-reduce:transition-none motion-reduce:translate-none! motion-reduce:scale-none! focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "border-badge-default-border bg-(image:--badge-default-surface) text-primary-foreground shadow-badge-default",
        success:
          "badge-settle border-success-border bg-success-surface text-success-foreground",
        warning: "border-warning-border bg-warning-surface text-warning-foreground",
        info: "border-info-border bg-info-surface text-info-foreground",
        secondary:
          "bg-muted bg-(image:--texture-brush) text-foreground shadow-badge-secondary",
        destructive:
          "badge-shake border-destructive-border bg-destructive-surface text-destructive-foreground focus-visible:ring-destructive/20",
        outline:
          "border-control-border bg-transparent text-foreground hover:border-control-border-hover",
        ghost:
          "bg-transparent text-muted-foreground hover:bg-ghost-hover hover:text-foreground",
        link: "bg-transparent bg-(image:--badge-filament) bg-[length:calc(100%-6px)_1.5px] bg-[position:center_bottom_4px] bg-no-repeat px-[3px] text-primary hover:text-primary-hover",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
