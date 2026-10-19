"use client";

import { useSearchParams } from "next/navigation";
import { Fragment, useState, type ReactNode } from "react";

// Campos de FilterBar que siguen a la pagina (entrega 10.3, hallazgo 10 de la
// 10.2). «Limpiar», Atras y Adelante cambian la URL con next/link, y Next
// vuelve a pintar la pagina sin montarla: React actualiza el defaultValue de
// un input que nadie toco, pero un select solo lo lee al montarse, y un campo
// escrito sin enviar conserva lo escrito. Por eso los campos se vuelven a
// montar cuando el servidor los pinta para otra consulta, y muestran los
// filtros que la pagina leyo de ella; con la misma consulta (una accion de
// fila, el refresh del panel) conservan lo que el usuario eligio. Los botones
// de la barra quedan fuera: «Limpiar» conserva el foco.
//
// La key es la consulta que habia cuando llegaron los campos, no la de ahora
// (verificacion de la 10.3a): Atras y Adelante confirman la URL con la pagina
// que ya se ve y piden al servidor la de la URL restaurada, y el panel de una
// ruta interceptada cambia la URL sin cambiar la lista. Con la URL como key,
// los campos se montaban con los valores de la pagina vieja y ya no cambiaban
// al llegar los nuevos. Unos campos nuevos son otros children: se guardan con
// la consulta en el render, como DateRangeFields guarda sus fechas.
//
// Fuera del App Router (una prueba que pinta la barra sola) el hook devuelve
// null aunque su tipo no lo diga.
export function FilterBarFields({ children }: { children: ReactNode }) {
  const query = useSearchParams()?.toString() ?? "";
  const [fields, setFields] = useState({ children, query });

  if (fields.children !== children) {
    setFields({ children, query });
  }

  return <Fragment key={fields.query}>{children}</Fragment>;
}
