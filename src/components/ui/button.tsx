/**
 * Boton compartido (shadcn) con las variantes de la marca. Desde el diseno de
 * los botones (propuesta del responsable, 2026-11-19) cada estado de cada
 * variante usa un token de tokens.css: la accion principal es un degradado
 * corto con filo de luz, outline tiene un borde que se ve (3:1) y la variante
 * "clear" (limpiar filtros) es un tinte cobre con borde, en lugar del cian.
 * El foco de teclado es un anillo de 2px separado por 2px del color de fondo,
 * rojo en destructive; la regla global de patterns.css no alcanza al boton.
 * Animacion de tacto: sube 1px al pasar el puntero y al pulsarlo baja 1px y se
 * encoge al 97 %, en --motion-fast; link no se mueve. Con reducir movimiento
 * no hay transicion ni desplazamiento.
 *
 * Diseno de listados (2026-11-21; D166): la variante "row-link" es la accion de
 * una fila (Editar, Activar): texto claro de 13 px sin relleno, 24 px de alto,
 * con el subrayado transparente; al pasar el puntero toma --primary-hover y el
 * subrayado aparece. No se mueve, como link.
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
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,text-decoration-color,box-shadow,translate,scale,opacity] duration-(--motion-fast) ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:-translate-y-px active:not-aria-[haspopup]:translate-y-px active:not-aria-[haspopup]:scale-97 motion-reduce:transition-none motion-reduce:translate-none! motion-reduce:scale-none! disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary bg-linear-to-b from-primary-hover to-primary text-primary-foreground shadow-button hover:bg-none hover:bg-primary-hover active:bg-none active:bg-primary-active active:shadow-none",
        outline:
          "border-control-border bg-transparent text-foreground hover:border-control-border-hover hover:bg-muted aria-expanded:border-control-border-hover aria-expanded:bg-muted",
        secondary:
          "border-border bg-accent text-foreground hover:bg-secondary-hover aria-expanded:bg-secondary-hover",
        ghost:
          "bg-transparent text-foreground hover:bg-ghost-hover aria-expanded:bg-ghost-hover",
        destructive:
          "border-destructive-border bg-destructive-surface text-destructive-foreground hover:border-destructive-outline hover:bg-destructive-surface-hover focus-visible:ring-destructive-outline",
        link: "text-primary underline decoration-link-underline decoration-1 underline-offset-4 hover:translate-y-0 hover:decoration-primary active:not-aria-[haspopup]:translate-y-0 active:not-aria-[haspopup]:scale-100",
        clear:
          "border-clear-border bg-clear-surface text-clear-foreground hover:bg-clear-surface-hover",
        "row-link":
          "bg-transparent text-foreground underline decoration-transparent underline-offset-2 hover:translate-y-0 hover:text-primary-hover hover:decoration-current active:not-aria-[haspopup]:translate-y-0 active:not-aria-[haspopup]:scale-100",
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
    // row-link no tiene relleno y mide 24 px con cualquier tamano: va aqui porque cva pone los
    // compoundVariants despues del tamano, y cn deja la ultima clase de cada grupo.
    compoundVariants: [{ variant: "row-link", className: "h-6 px-0 text-[13px]" }],
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
// sigue siendo enfocable.
const pendingAttributes = { "aria-disabled": true, "aria-busy": true } as const

// La guarda de clic solo va cuando hay algo que cancelar: un envio (submit es
// el tipo por defecto; preventDefault cancela tambien el envio) o un onClick
// propio. Un pendiente de tipo button sin onClick no lleva funciones, asi que
// un componente de servidor puede pintarlo: React Server Components no admite
// manejadores en un elemento que llega del servidor (la galeria daba 500).
const pendingClickGuard = {
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
  const needsClickGuard = props.type !== "button" || props.onClick !== undefined

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
      {...(showPending && needsClickGuard ? pendingClickGuard : undefined)}
    >
      {content}
    </Comp>
  )
}

export { Button, buttonVariants, type ButtonProps }
