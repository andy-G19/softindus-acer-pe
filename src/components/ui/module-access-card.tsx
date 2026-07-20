/**
 * Ubicación destino: src/components/ui/module-access-card.tsx (reemplaza el archivo actual)
 *
 * Cambios respecto al original:
 * - Nuevo prop `icon` (lucide-react) con badge de color de fondo suave.
 * - Nuevo prop opcional `tone` (chart-1..chart-5) — reutiliza los colores
 *   categóricos que ya existen en globals.css, no introduce hex nuevos.
 * - Nuevo prop opcional `index` — número grande y muy tenue en la esquina
 *   superior derecha (solo decorativo, aria-hidden).
 * - El color de acento se pasa vía CSS custom property (--card-accent) en
 *   el estilo inline del <Link>, y las clases de Tailwind (hover:border-*)
 *   son un string ESTÁTICO que referencia esa variable — así el JIT de
 *   Tailwind sí genera la clase (no se puede interpolar un color dinámico
 *   directo en el nombre de la clase, el compilador no lo detectaría).
 */
import Link from "next/link";
import { Circle, type LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  /** Opcional a propósito: las páginas que aún no se actualizaron con un
   * ícono curado (ej. production/page.tsx) siguen compilando y muestran
   * un ícono genérico en su lugar. */
  icon?: LucideIcon;
  tone?: ModuleCardTone;
  index?: number;
};

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
      style={{ "--card-accent": `var(--${tone})` } as React.CSSProperties}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
    >
      <Card className="relative h-full border border-border/80 bg-card transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--card-accent)_45%,transparent)] hover:bg-secondary hover:shadow-[0_16px_34px_rgba(0,0,0,0.24)]">
        {index ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-3 right-4 font-heading text-4xl font-bold text-foreground/[0.06]"
          >
            {index.toString().padStart(2, "0")}
          </span>
        ) : null}

        <CardHeader className="pb-2">
          <div
            className="mb-3 flex size-11 items-center justify-center rounded-xl"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--card-accent) 16%, transparent)",
              color: "var(--card-accent)",
            }}
          >
            <Icon className="size-5" aria-hidden="true" />
          </div>
          <CardTitle className="text-base font-semibold text-foreground">
            {title}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
