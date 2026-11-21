/**
 * Acceso a un modulo (las tarjetas de las pantallas de inicio de cada area). Desde el diseno de
 * la presentacion (propuesta del responsable, 2026-11-20; D158) es una placa de acero cepillado
 * con el numero de fondo, el icono en un casco del color del modulo, el titulo y la descripcion
 * abajo, y una flecha que aparece con la intencion (puntero o foco en el enlace). Con ella la
 * placa sube, el borde toma el acento (cierra D101), el icono crece, el numero se desplaza y se
 * tine, y el resplandor sigue el puntero (PointerSpotlight). En reposo el numero y el icono
 * respiran despacio, desfasados segun el indice, como en la propuesta. Los estilos viven en
 * patterns.css (.module-*) y leen el acento de --module-accent.
 *
 * tone elige uno de los colores categoricos (chart-1 a chart-5); icon es opcional para que una
 * pagina sin icono curado siga compilando, y muestra un circulo generico. Sigue siendo un
 * componente de servidor: icon es una funcion y no puede pasar a uno de cliente.
 */
import type { CSSProperties } from "react";
import Link from "next/link";
import { Circle, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { PointerSpotlight } from "@/components/ui/pointer-spotlight";

export type ModuleCardTone =
  | "chart-1"
  | "chart-2"
  | "chart-3"
  | "chart-4"
  | "chart-5";

type ModuleAccessCardProps = {
  title: string;
  description: string;
  href: string;
  icon?: LucideIcon;
  tone?: ModuleCardTone;
  index?: number;
};

// Desfase de la respiracion de cada modulo, como la propuesta: 0,4 s el numero y 0,65 s el
// icono por cada posicion. Redondeado a centesimas para no escribir 1.2000000000000002s.
function breathDelay(index: number | undefined, step: number) {
  const position = index ? index - 1 : 0;
  return `${Math.round(position * step * 100) / 100}s`;
}

export function ModuleAccessCard({
  title,
  description,
  href,
  icon: Icon = Circle,
  tone = "chart-1",
  index,
}: ModuleAccessCardProps) {
  return (
    <Link
      href={href}
      className="spotlight-host block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
    >
      <Card
        style={{ "--module-accent": `var(--${tone})` } as CSSProperties & Record<"--module-accent", string>}
        className="module-card h-full gap-3 px-5 py-[18px]"
      >
        <PointerSpotlight />

        {index ? (
          <span
            data-slot="module-number"
            aria-hidden="true"
            className="module-number"
            style={{ animationDelay: breathDelay(index, 0.4) }}
          >
            {index.toString().padStart(2, "0")}
          </span>
        ) : null}

        <span
          data-slot="module-icon"
          aria-hidden="true"
          className="module-icon"
          style={{ animationDelay: breathDelay(index, 0.65) }}
        >
          <Icon />
        </span>

        <div className="module-bottom">
          <div className="flex flex-col gap-1">
            <div data-slot="module-title" className="module-title">
              {title}
            </div>
            <p data-slot="module-description" className="module-description">
              {description}
            </p>
          </div>
          <span data-slot="module-arrow" aria-hidden="true" className="module-arrow">
            →
          </span>
        </div>
      </Card>
    </Link>
  );
}
