/**
 * Helper puro de headers de seguridad HTTP. No importa "server-only" ni
 * @/lib/env a proposito: este modulo se importa desde next.config.ts, que
 * se carga con resolucion de modulos de Node plano (fuera del bundler de
 * Next), asi que cualquier import server-only rompería el build.
 */

export type HttpHeader = { key: string; value: string };

const PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()";

export function buildContentSecurityPolicy(isProduction: boolean): string {
  const scriptSrc = isProduction
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-eval' 'unsafe-inline'";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "media-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join("; ");
}

export function getBaseSecurityHeaders(): HttpHeader[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "X-DNS-Prefetch-Control", value: "on" },
  ];
}

export function getHstsHeader(): HttpHeader {
  return {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  };
}

/**
 * CSP en modo Report-Only: la politica sigue exactamente el estandar
 * pedido pero no bloquea nada todavia (solo se reportaria via el header,
 * ya que no hay endpoint de report-uri configurado). Se eligio Report-Only
 * en vez de enforcing porque no hay forma de validar en un navegador real
 * contra el stack de la app (Tailwind v4, radix-ui, sweetalert2,
 * react-toastify, estilos inline via prop `style`) antes de desplegar, y
 * la prioridad explicita de este bloque es no romper el sistema.
 */
export function getSecurityHeaders(isProduction: boolean): HttpHeader[] {
  const headers = [...getBaseSecurityHeaders()];

  if (isProduction) {
    headers.push(getHstsHeader());
  }

  headers.push({
    key: "Content-Security-Policy-Report-Only",
    value: buildContentSecurityPolicy(isProduction),
  });

  return headers;
}

export function getApiCacheHeaders(): HttpHeader[] {
  return [{ key: "Cache-Control", value: "no-store, max-age=0" }];
}
