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
    <nav aria-label="Ruta de navegación" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
              ) : null}

              {isLast ? (
                <span
                  aria-current="page"
                  className="max-w-48 truncate text-foreground sm:max-w-none"
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className={cn(
                    "max-w-48 truncate transition hover:text-foreground sm:max-w-none",
                  )}
                >
                  {item.label}
                </Link>
              ) : (
                <span className="max-w-48 truncate sm:max-w-none">
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
