import Link from "next/link";

// Migas de pan. Desde el diseno de listados y navegacion (propuesta del responsable, 2026-11-21;
// D168): texto de 13 px con 8 px entre partes, el separador «›» en gris atenuado (oculto al lector
// de pantalla, que ya anuncia la lista), los enlaces en gris que al pasar el puntero se aclaran con
// subrayado (ya no toman el cobre) y la pagina actual en claro y semibold. Sigue en una linea que
// se desplaza en pantallas estrechas, con cada parte recortada.

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Ruta de navegación"
      className="max-w-full overflow-x-auto text-[13px] text-muted-foreground [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ol className="flex min-w-0 items-center gap-2 whitespace-nowrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li
              key={`${item.label}-${index}`}
              className="flex min-w-0 shrink-0 items-center gap-2 last:min-w-0 last:shrink"
            >
              {index > 0 ? (
                <span aria-hidden="true" className="shrink-0 text-muted-foreground/60 select-none">
                  ›
                </span>
              ) : null}

              {isLast ? (
                <span
                  aria-current="page"
                  className="block max-w-48 truncate font-semibold text-foreground sm:max-w-72 md:max-w-none"
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="block max-w-48 truncate underline-offset-2 transition-colors duration-(--motion-fast) ease-out hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:max-w-72 md:max-w-none"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="block max-w-48 truncate sm:max-w-72 md:max-w-none">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
