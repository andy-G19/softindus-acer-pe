"use client";

import { useSearchParams } from "next/navigation";
import { Fragment, type ReactNode } from "react";

// Campos de FilterBar que siguen a la URL (entrega 10.3, hallazgo 10 de la
// 10.2). «Limpiar», Atras y Adelante cambian la URL con next/link, y Next
// vuelve a pintar la pagina sin montarla: React actualiza el defaultValue de
// un input que nadie toco, pero un select solo lo lee al montarse, y un campo
// escrito sin enviar conserva lo escrito. Con la consulta de la URL como key,
// los campos se vuelven a montar cuando cambia y muestran los filtros que la
// pagina leyo de ella; mientras no cambia, conservan lo que el usuario eligio.
// Los botones de la barra quedan fuera: «Limpiar» conserva el foco.
//
// Fuera del App Router (una prueba que pinta la barra sola) el hook devuelve
// null aunque su tipo no lo diga.
export function FilterBarFields({ children }: { children: ReactNode }) {
  const query = useSearchParams()?.toString() ?? "";

  return <Fragment key={query}>{children}</Fragment>;
}
