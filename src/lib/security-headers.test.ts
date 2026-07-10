import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  getApiCacheHeaders,
  getBaseSecurityHeaders,
  getSecurityHeaders,
} from "@/lib/security-headers";

describe("getBaseSecurityHeaders", () => {
  it("incluye los headers basicos de seguridad", () => {
    const headers = getBaseSecurityHeaders();
    const keys = headers.map((header) => header.key);

    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("X-Frame-Options");
    expect(keys).toContain("Referrer-Policy");
    expect(keys).toContain("Permissions-Policy");
    expect(keys).toContain("X-DNS-Prefetch-Control");
  });

  it("restringe camara, microfono y geolocalizacion en Permissions-Policy", () => {
    const headers = getBaseSecurityHeaders();
    const permissionsPolicy = headers.find(
      (header) => header.key === "Permissions-Policy",
    );

    expect(permissionsPolicy?.value).toContain("camera=()");
    expect(permissionsPolicy?.value).toContain("microphone=()");
    expect(permissionsPolicy?.value).toContain("geolocation=()");
  });

  it("usa DENY para X-Frame-Options", () => {
    const headers = getBaseSecurityHeaders();
    const frameOptions = headers.find(
      (header) => header.key === "X-Frame-Options",
    );

    expect(frameOptions?.value).toBe("DENY");
  });
});

describe("getSecurityHeaders", () => {
  it("no incluye Strict-Transport-Security fuera de produccion", () => {
    const headers = getSecurityHeaders(false);

    expect(headers.some((header) => header.key === "Strict-Transport-Security")).toBe(
      false,
    );
  });

  it("incluye Strict-Transport-Security solo en produccion", () => {
    const headers = getSecurityHeaders(true);
    const hsts = headers.find(
      (header) => header.key === "Strict-Transport-Security",
    );

    expect(hsts?.value).toContain("max-age=63072000");
    expect(hsts?.value).toContain("includeSubDomains");
    expect(hsts?.value).toContain("preload");
  });

  it("incluye la CSP en modo Report-Only", () => {
    const headers = getSecurityHeaders(true);
    const csp = headers.find(
      (header) => header.key === "Content-Security-Policy-Report-Only",
    );

    expect(csp).toBeDefined();
  });
});

describe("buildContentSecurityPolicy", () => {
  it("bloquea el uso en iframes con frame-ancestors 'none'", () => {
    expect(buildContentSecurityPolicy(true)).toContain("frame-ancestors 'none'");
  });

  it("restringe el origen por defecto a 'self'", () => {
    expect(buildContentSecurityPolicy(true)).toContain("default-src 'self'");
  });

  it("permite unsafe-eval solo fuera de produccion", () => {
    expect(buildContentSecurityPolicy(false)).toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy(true)).not.toContain("'unsafe-eval'");
  });
});

describe("getApiCacheHeaders", () => {
  it("desactiva el cache para respuestas de API sensibles", () => {
    const headers = getApiCacheHeaders();
    const cacheControl = headers.find((header) => header.key === "Cache-Control");

    expect(cacheControl?.value).toBe("no-store, max-age=0");
  });
});
