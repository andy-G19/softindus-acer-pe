import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  buildPaginationQueryString,
  type PaginationMeta,
  type SearchParamsInput,
} from "@/lib/pagination";

type PaginationControlsProps = {
  meta: PaginationMeta;
  basePath: string;
  searchParams: SearchParamsInput;
  itemLabel?: string;
};

// Server Component puro (sin "use client"): la navegación entre páginas se
// resuelve con <Link>, sin necesitar estado ni handlers en el cliente. Desde el
// diseño de listados (2026-11-21; D171) «Anterior» y «Siguiente» llevan una
// flecha decorativa hacia su lado, como en la maqueta.
export function PaginationControls({
  meta,
  basePath,
  searchParams,
  itemLabel = "registros",
}: PaginationControlsProps) {
  const {
    page,
    totalPages,
    totalItems,
    pageSize,
    hasPreviousPage,
    hasNextPage,
  } = meta;

  const previousHref = `${basePath}?${buildPaginationQueryString(searchParams, { page: page - 1 })}`;
  const nextHref = `${basePath}?${buildPaginationQueryString(searchParams, { page: page + 1 })}`;

  const firstItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Mostrando {firstItem}-{lastItem} de {totalItems} {itemLabel} · Página{" "}
        {page} de {totalPages}
      </p>

      <div className="flex gap-2">
        {hasPreviousPage ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={previousHref}>
              <ArrowLeft data-icon="inline-start" aria-hidden="true" />
              Anterior
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Anterior
          </Button>
        )}

        {hasNextPage ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={nextHref}>
              Siguiente
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Siguiente
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
