/**
 * Tarjeta compartida (shadcn). Desde el diseno de la presentacion (propuesta del responsable,
 * 2026-11-20; D156) es una placa de acero cepillado: la superficie elevada (--card) con la
 * textura de metal (--texture-metal) en mosaicos de 180 px que se desplazan una vuelta cada 18 s
 * (.card-brushed de brand.css, la excepcion elegida a la quietud en reposo de D153), borde comun
 * y radio de 10 px. Al pasar el puntero solo aclara el borde (D160): una tarjeta con un
 * formulario no debe saltar. La transicion de translate y sombra, y el freno de reducir
 * movimiento, sirven al indicador (KpiCard), que sube desde patterns.css; sobre el fondo de la
 * pagina quedaba hundida bajo el shell (D159). La barra termica es el barrido de .heat-sweep en
 * su riel fino de 3 px (.heat-sweep-thin), que ya no usa la barra .heat-bar.
 */
import * as React from "react"

import { cn } from "@/lib/utils"

function Card({
  className,
  heatBar = false,
  size = "default",
  children,
  ...props
}: React.ComponentProps<"div"> & {
  heatBar?: boolean
  size?: "default" | "sm"
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card card-brushed flex flex-col gap-(--card-spacing) overflow-hidden rounded-lg border border-border bg-card bg-(image:--texture-metal) bg-[length:180px_180px] py-(--card-spacing) text-sm text-card-foreground transition-[border-color,translate,box-shadow] duration-(--motion-base) ease-out hover:border-control-border-hover motion-reduce:transition-none motion-reduce:translate-none! [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg",
        heatBar && "pt-0",
        className
      )}
      {...props}
    >
      {heatBar ? (
        <div className="heat-sweep heat-sweep-thin shrink-0" aria-hidden="true" />
      ) : null}
      {children}
    </div>
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-lg px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-lg border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
