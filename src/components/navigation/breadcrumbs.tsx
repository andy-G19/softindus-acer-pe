import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

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
      className="max-w-full overflow-x-auto text-sm text-muted-foreground [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ol className="flex min-w-0 items-center gap-1 whitespace-nowrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li
              key={`${item.label}-${index}`}
              className="flex min-w-0 shrink-0 items-center gap-1 last:min-w-0 last:shrink"
            >
              {index > 0 ? (
                <ChevronRight
                  className="size-3.5 shrink-0 text-muted-foreground/60"
                  aria-hidden="true"
                />
              ) : null}

              {isLast ? (
                <span
                  aria-current="page"
                  className="block max-w-48 truncate text-foreground sm:max-w-72 md:max-w-none"
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className={cn(
                    "block max-w-48 truncate transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:max-w-72 md:max-w-none"
                  )}
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
