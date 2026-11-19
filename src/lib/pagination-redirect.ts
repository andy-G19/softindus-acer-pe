import { redirect } from "next/navigation";

import {
  buildPaginationQueryString,
  type PaginationMeta,
  type SearchParamsInput,
} from "@/lib/pagination";

/**
 * La direccion de la ultima pagina que existe, con los mismos filtros. Si la ultima es la primera,
 * va sin `page`, como el enlace «Anterior» de la segunda pagina.
 */
export function lastPageHref(meta: PaginationMeta, basePath: string, searchParams: SearchParamsInput) {
  const query = buildPaginationQueryString(searchParams, {
    page: meta.totalPages > 1 ? meta.totalPages : undefined,
  });

  return query ? `${basePath}?${query}` : basePath;
}

/**
 * C3 del grupo de fixes (D126, hallazgo 6 de la 11.3c): si la pagina pedida pasa de la ultima (un
 * enlace viejo, o anular la ultima fila de la ultima pagina), redirige a la ultima con los mismos
 * filtros. La consulta ya uso el `skip` de la pagina pedida y vino vacia: mostrarla dejaba la
 * tabla vacia con un mensaje de «Todavia no hay…» falso y los dos botones deshabilitados.
 *
 * Va en la pagina, justo despues de `getPaginationMeta`, con el `basePath` y los `searchParams` que
 * recibe `PaginationControls`. `pagination.ts` no redirige porque tambien lo usa la galeria en el
 * cliente. `pagination-beyond-last.test.ts` exige la llamada en toda pagina paginada.
 */
export function redirectBeyondLastPage({
  page,
  meta,
  basePath,
  searchParams,
}: {
  /** La pagina pedida, la de `getPaginationParams` (la de `meta` ya viene recortada). */
  page: number;
  meta: PaginationMeta;
  basePath: string;
  searchParams: SearchParamsInput;
}) {
  if (page > meta.totalPages) {
    redirect(lastPageHref(meta, basePath, searchParams));
  }
}
