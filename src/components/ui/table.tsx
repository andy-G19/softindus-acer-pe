"use client"

// Tabla compartida (shadcn). Desde el diseno de listados y navegacion (propuesta del responsable,
// 2026-11-21; D163) la cabecera es acero cepillado: cada celda lleva --accent con la textura de
// metal (en thead la taparia el hover de la fila), letra mono de 10,5 px en negrita con espaciado
// de 0,08em, una linea de acero de 2 px debajo y el filo de luz con sombra de
// --shadow-table-head. Las reglas de tabla de patterns.css ya no la pisan (D164). Las filas tienen
// las medidas de la maqueta, sin cebra (D165): texto de 13,5 px, celda de 13 px por 16 px, linea de
// --border y hover --muted; la primera columna (el codigo, o la fecha que abre la fila) en mono de
// 12,5 px y gris tenue, salvo una celda que abarca columnas (el vacio, «Totales»), que va en gris
// sin ser codigo, y una con data-cell="text": un nombre (producto, material, maquina, operario) es
// el dato principal de su fila y no se atenua.
import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto rounded-xl border border-border bg-card"
    >
      <table
        data-slot="table"
        className={cn("w-full min-w-max caption-bottom text-[13.5px]", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "text-foreground [&_tr]:border-b [&_tr]:border-border",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-border bg-secondary font-medium text-foreground [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border transition-colors duration-(--motion-fast) ease-out hover:bg-muted has-aria-expanded:bg-muted data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "border-b-2 border-control-border-hover bg-accent bg-(image:--texture-metal) px-4 py-3 text-left align-middle font-mono text-[10.5px] font-bold tracking-[0.08em] uppercase whitespace-nowrap text-foreground shadow-table-head [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-[13px] align-middle whitespace-nowrap text-foreground tabular-nums [&:first-child:not([colspan]):not([data-cell=text])]:font-mono [&:first-child:not([colspan]):not([data-cell=text])]:text-[12.5px] [&:first-child:not([colspan]):not([data-cell=text])]:text-muted-foreground [&:has([role=checkbox])]:pr-0 [&[colspan]]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
