/**
 * Etiqueta compartida (shadcn). Desde el diseno de la presentacion (propuesta del responsable,
 * 2026-11-20; D153 y D154) es un rectangulo de 24 px con radio de 6 px, letra sans de 11 px en
 * negrita y mayusculas, y cada variante toma su color de un token de tokens.css: default es una
 * placa de acero con texto cobre y una franja cobre a la izquierda (D161: el lingote relleno con
 * resplandor se confundia con el boton primario), secondary acero cepillado (antes se veia igual
 * que info), success, warning, info y destructive las superficies de las alertas, y outline,
 * ghost y link acompanan texto sin competir con el. Al pasar el puntero solo se aclara (D162:
 * subir y crecer invitaba a pulsar algo que no se pulsa). En reposo no se mueve (D153): success
 * se asienta con un sello al montar y destructive sacude una vez (.badge-settle y .badge-shake
 * de patterns.css), salvo que gesture pida otro. Con reducir movimiento no hay transicion ni gesto.
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-2.5 font-sans text-[11px] font-bold uppercase tracking-[0.03em] whitespace-nowrap transition-[color,background-color,border-color,box-shadow,filter] duration-(--motion-base) ease-out hover:brightness-110 motion-reduce:transition-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-primary shadow-badge-default",
        success: "border-success-border bg-success-surface text-success-foreground",
        warning: "border-warning-border bg-warning-surface text-warning-foreground",
        info: "border-info-border bg-info-surface text-info-foreground",
        secondary:
          "bg-muted bg-(image:--texture-brush) text-foreground shadow-badge-secondary",
        destructive:
          "border-destructive-border bg-destructive-surface text-destructive-foreground focus-visible:ring-destructive/20",
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

// Gesto al montar, una sola vez (patterns.css). Cada variante trae el suyo y gesture lo reemplaza:
// StateBadge sella un registro aunque sea info, deja que entregado solo se asiente y hace entrar
// a un anulado con un golpe de sello en lugar de la sacudida (D155).
const badgeGestures = {
  settle: "badge-settle",
  pop: "badge-pop",
  shake: "badge-shake",
  stamp: "badge-stamp",
  none: null,
} as const

type BadgeGesture = keyof typeof badgeGestures

const defaultGestures: Partial<
  Record<NonNullable<VariantProps<typeof badgeVariants>["variant"]>, BadgeGesture>
> = {
  success: "settle",
  destructive: "shake",
}

function Badge({
  className,
  variant = "default",
  gesture,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
    gesture?: BadgeGesture
  }) {
  const Comp = asChild ? Slot.Root : "span"
  const gestureClass =
    badgeGestures[gesture ?? (variant ? defaultGestures[variant] : undefined) ?? "none"]

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), gestureClass, className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants, type BadgeGesture }
