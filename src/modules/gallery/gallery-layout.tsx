import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Estructura comun de la galeria de componentes (entrega 8): un indice, una
// seccion por familia y una muestra rotulada por estado. La galeria es una
// herramienta interna para ADMIN: muestra cada componente compartido con datos
// ficticios, sin consultar la base ni ejecutar acciones del servidor.

export const GALLERY_SECTIONS = [
  { id: "fundamentos", title: "Fundamentos" },
  { id: "botones", title: "Botones" },
  { id: "campos", title: "Campos" },
  { id: "mensajes", title: "Mensajes y estados" },
  { id: "presentacion", title: "Presentación" },
  { id: "listados", title: "Listados y navegación" },
] as const;

export type GallerySectionId = (typeof GALLERY_SECTIONS)[number]["id"];

export function GalleryToc() {
  return (
    <nav aria-label="Secciones de la galería" className="flex flex-wrap gap-2">
      {GALLERY_SECTIONS.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="rounded-lg border border-border/80 bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
        >
          {section.title}
        </a>
      ))}
    </nav>
  );
}

type GallerySectionProps = {
  id: GallerySectionId;
  description: string;
  children: ReactNode;
};

export function GallerySection({ id, description, children }: GallerySectionProps) {
  const title = GALLERY_SECTIONS.find((section) => section.id === id)?.title;

  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className="scroll-mt-28 space-y-6 rounded-xl border border-border/80 bg-card p-4 sm:p-6"
    >
      <header className="space-y-1">
        <h2 id={`${id}-titulo`} className="font-heading text-xl font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  );
}

type GallerySampleProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

// Una muestra: el nombre del caso o estado y el componente tal como lo usan
// las pantallas.
export function GallerySample({ label, children, className }: GallerySampleProps) {
  return (
    <figure className="min-w-0 space-y-2">
      <figcaption className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </figcaption>
      <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>
    </figure>
  );
}

export function GalleryNote({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>;
}
