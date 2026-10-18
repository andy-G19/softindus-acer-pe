import Link from "next/link";
import type { ReactNode } from "react";

import { FilterBarFields } from "@/components/forms/filter-bar-fields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilterBarProps = {
  /** Ruta del listado: el formulario la vuelve a pedir con los filtros en la URL. */
  action: string;
  /** Nombre de la region de busqueda para el lector de pantalla: "Filtros de clientes". */
  label: string;
  /** Enlace que quita los filtros (normalmente, la misma ruta sin parametros). */
  clearHref: string;
  submitLabel?: string;
  clearLabel?: string;
  className?: string;
  children: ReactNode;
};

// Barra de filtros compartida (entrega 8): un formulario GET con el contenedor
// que mas repiten los listados y una sola rejilla que se adapta al ancho
// (columnas de al menos 12rem) en lugar de una por pantalla. Es un contenedor
// de consultas (@container): un campo ancho, como el rango de fechas, ocupa dos
// columnas solo si la barra tiene sitio, aunque este dentro de un panel. Los
// campos se vuelven a montar cuando cambia la URL (FilterBarFields), asi que
// «Limpiar», Atras y Adelante muestran los filtros que aplica la pagina.
export function FilterBar({
  action,
  label,
  clearHref,
  submitLabel = "Filtrar",
  clearLabel = "Limpiar filtros",
  className,
  children,
}: FilterBarProps) {
  return (
    <form
      method="GET"
      action={action}
      role="search"
      aria-label={label}
      className={cn(
        "@container grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm",
        className,
      )}
    >
      <FilterBarFields>{children}</FilterBarFields>
      <div className="flex flex-wrap items-end gap-2">
        <Button type="submit">{submitLabel}</Button>
        <Button variant="clear" asChild>
          <Link href={clearHref}>{clearLabel}</Link>
        </Button>
      </div>
    </form>
  );
}
