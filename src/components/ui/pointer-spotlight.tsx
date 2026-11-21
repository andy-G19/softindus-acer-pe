"use client";

import { useEffect, useRef } from "react";

/**
 * Resplandor que sigue el puntero (propuesta de la presentacion, 2026-11-20; D157 y D158). Capa
 * decorativa que se pone dentro de una tarjeta: escucha el movimiento del puntero sobre su
 * anfitrion (el .spotlight-host mas cercano, o su padre) y escribe en si misma la posicion en
 * porcentaje (--spotlight-x, --spotlight-y). .pointer-spotlight de patterns.css dibuja el circulo
 * con el color, el tamano y la intensidad de tokens.css o los que el anfitrion redefina
 * (--spotlight-color, --spotlight-size, --spotlight-strength, --spotlight-fade) y solo lo muestra
 * con el anfitrion bajo el puntero o con foco de teclado.
 *
 * Es un hijo de cliente a proposito: KpiCard y ModuleAccessCard reciben icon, una funcion, que no
 * puede pasar de un componente de servidor a uno de cliente; asi las tarjetas siguen siendo de
 * servidor y solo esta capa lleva JavaScript. En el servidor no tiene posicion: el CSS parte del
 * centro de arriba hasta el primer movimiento.
 */
export function PointerSpotlight() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const spotlight = ref.current;
    const host = spotlight?.closest<HTMLElement>(".spotlight-host") ?? spotlight?.parentElement;

    if (!spotlight || !host) {
      return;
    }

    function follow(event: PointerEvent) {
      const box = host!.getBoundingClientRect();

      if (box.width === 0 || box.height === 0) {
        return;
      }

      spotlight!.style.setProperty(
        "--spotlight-x",
        `${(((event.clientX - box.left) / box.width) * 100).toFixed(1)}%`,
      );
      spotlight!.style.setProperty(
        "--spotlight-y",
        `${(((event.clientY - box.top) / box.height) * 100).toFixed(1)}%`,
      );
    }

    host.addEventListener("pointermove", follow);

    return () => host.removeEventListener("pointermove", follow);
  }, []);

  return <span ref={ref} data-slot="pointer-spotlight" aria-hidden="true" className="pointer-spotlight" />;
}
