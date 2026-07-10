export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE = 1;

export type SearchParamsInput = Record<string, string | string[] | undefined>;

export type PaginationParams = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

function toSingleValue(value: string | string[] | undefined | null) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parsea el numero de pagina desde un query param. Cualquier valor
 * invalido, negativo, NaN o no numerico cae de vuelta a la pagina 1: nunca
 * se propaga un skip negativo o absurdo hacia Prisma.
 */
export function parsePageParam(value: string | string[] | undefined | null): number {
  const raw = toSingleValue(value);
  const parsed = Number.parseInt(raw ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < MIN_PAGE) {
    return MIN_PAGE;
  }

  return parsed;
}

/**
 * Parsea el tamaño de pagina desde un query param. Protege contra valores
 * invalidos, negativos, cero o excesivamente grandes: nunca deja pedir mas
 * de MAX_PAGE_SIZE registros en una sola consulta.
 */
export function parsePageSizeParam(
  value: string | string[] | undefined | null,
  defaultPageSize: number = DEFAULT_PAGE_SIZE,
): number {
  const raw = toSingleValue(value);
  const parsed = Number.parseInt(raw ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return defaultPageSize;
  }

  return Math.min(parsed, MAX_PAGE_SIZE);
}

/**
 * Lee page/pageSize desde los searchParams de una pagina y devuelve
 * page/pageSize/skip/take listos para pasar directo a un findMany de
 * Prisma.
 */
export function getPaginationParams(
  params: SearchParamsInput,
  options: {
    pageKey?: string;
    pageSizeKey?: string;
    defaultPageSize?: number;
  } = {},
): PaginationParams {
  const pageKey = options.pageKey ?? "page";
  const pageSizeKey = options.pageSizeKey ?? "pageSize";

  const page = parsePageParam(params[pageKey]);
  const pageSize = parsePageSizeParam(params[pageSizeKey], options.defaultPageSize);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

/**
 * Calcula los metadatos de paginacion (total de paginas, si hay
 * anterior/siguiente) a partir del total real de registros (Prisma
 * `count()`). La pagina se acota entre 1 y totalPages solo para mostrarla
 * de forma segura en la UI (nunca "pagina 50 de 3"); el skip/take de la
 * consulta ya se calculo antes con getPaginationParams.
 */
export function getPaginationMeta({
  totalItems,
  page,
  pageSize,
}: {
  totalItems: number;
  page: number;
  pageSize: number;
}): PaginationMeta {
  const safeTotalItems = Math.max(0, totalItems);
  const totalPages = Math.max(1, Math.ceil(safeTotalItems / pageSize));
  const safePage = Math.min(Math.max(page, MIN_PAGE), totalPages);

  return {
    page: safePage,
    pageSize,
    totalItems: safeTotalItems,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
  };
}

/**
 * Reconstruye un query string a partir de los searchParams actuales,
 * conservando todos los filtros existentes y solo sobreescribiendo las
 * claves indicadas en overrides (tipicamente "page"). Un override con
 * valor undefined/null/"" elimina esa clave del resultado.
 */
export function buildPaginationQueryString(
  params: SearchParamsInput,
  overrides: Record<string, string | number | undefined | null> = {},
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key in overrides) {
      continue;
    }

    const single = toSingleValue(value);

    if (single) {
      search.set(key, single);
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    search.set(key, String(value));
  }

  return search.toString();
}
