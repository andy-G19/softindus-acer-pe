/**
 * Boton compartido (shadcn) con las variantes de la marca. La variante "clear"
 * (limpiar filtros) usa los tokens --accent-cyan, --accent-cyan-hover y
 * --accent-cyan-active; su tamano se pasa como className en cada pantalla.
 *
 * Entrega 8: estado pendiente (pending) y tipos que exigen aria-label en los
 * tamanos de solo icono. Sin pending, el HTML es el mismo de antes.
 *
 * Entrega 9: pendiente es aria-disabled, no disabled. Un boton disabled deja
 * de ser enfocable y Chromium manda el foco a body (K1 de la entrega 8); con
 * aria-disabled el foco se queda y el clic se ignora. Ojo: un disabled tambien
 * impedia que Enter en un campo enviara el formulario; esa guarda la pone
 * ActionForm.
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "forge-button-gradient text-primary-foreground hover:bg-primary",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        clear:
          "bg-[var(--accent-cyan)] text-accent-cyan-foreground hover:bg-[var(--accent-cyan-hover)] active:bg-[var(--accent-cyan-active)]",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>

// Los tamanos cuyo nombre empieza por "icon" no muestran texto.
type IconButtonSize = Extract<ButtonSize, `icon${string}`>

// Un boton de solo icono no tiene texto visible: sin aria-label, el lector de
// pantalla solo diria "boton".
type ButtonSizeProps =
  | { size?: Exclude<ButtonSize, IconButtonSize> | null }
  | { size: IconButtonSize; "aria-label": string }

// El estado pendiente es de un <button> propio: un enlace (asChild) no se
// envia ni se deshabilita.
type ButtonPendingProps =
  | {
      asChild?: false
      /** Marca aria-disabled y aria-busy, ignora el clic y muestra el spinner; conserva el foco. */
      pending?: boolean
      /** Texto mientras esta pendiente ("Guardando..."); si falta, se conserva el contenido. */
      pendingText?: React.ReactNode
    }
  | { asChild: true; pending?: never; pendingText?: never }

type ButtonProps = React.ComponentProps<"button"> &
  Pick<VariantProps<typeof buttonVariants>, "variant"> &
  ButtonSizeProps &
  ButtonPendingProps

// Pendiente se ve como deshabilitado (las mismas clases que disabled:) pero
// sigue siendo enfocable. preventDefault cancela tambien el envio de un submit.
const pendingAttributes = {
  "aria-disabled": true,
  "aria-busy": true,
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault(),
} as const

const pendingClasses = "pointer-events-none opacity-50"

function isIconSize(size: ButtonSize | null): size is IconButtonSize {
  return size?.startsWith("icon") ?? false
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  pending = false,
  pendingText,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"
  const showPending = pending && !asChild

  // Pendiente: en solo icono el spinner reemplaza al icono (el aria-label se
  // mantiene); con texto, va al inicio como un icono inline-start.
  let content = children
  if (showPending) {
    content = isIconSize(size) ? (
      <Spinner />
    ) : (
      <>
        <Spinner data-icon="inline-start" />
        {pendingText ?? children}
      </>
    )
  }

  // Los atributos pendientes van despues de props: ganan a un onClick o a un
  // aria-disabled={false} del formulario y, sin pending, no se agrega nada,
  // asi que el HTML de cada pantalla no cambia.
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }), showPending && pendingClasses)}
      {...props}
      {...(showPending ? pendingAttributes : undefined)}
    >
      {content}
    </Comp>
  )
}

export { Button, buttonVariants, type ButtonProps }
