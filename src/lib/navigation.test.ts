import { describe, expect, it } from "vitest";

import { createReturnToHref, getSafeReturnTo, hasListFilters, withReturnTo } from "@/lib/navigation";

const CLIENTS = "/dashboard/commercial/clients";
const FALLBACK = "/dashboard/fallback";

// El viaje real de un returnTo: el listado arma su URL con los filtros, el
// enlace la codifica en ?returnTo=, Next decodifica el parametro una vez y la
// pagina de destino lo valida con getSafeReturnTo.
function roundTrip(listParams: Record<string, string>) {
  const returnTo = createReturnToHref(CLIENTS, listParams);
  const href = withReturnTo(`${CLIENTS}/CLI00000001/edit`, returnTo);
  const received = new URL(href, "https://erp.example").searchParams.get("returnTo") ?? undefined;

  return { returnTo, back: getSafeReturnTo(received, FALLBACK) };
}

describe("createReturnToHref y withReturnTo", () => {
  it("arman la URL del listado sin returnTo y la codifican en el enlace", () => {
    const returnTo = createReturnToHref(CLIENTS, { q: "acero", page: "2", returnTo: "/dashboard" });

    expect(returnTo).toBe(`${CLIENTS}?q=acero&page=2`);
    expect(withReturnTo(`${CLIENTS}/new`, returnTo)).toBe(
      `${CLIENTS}/new?returnTo=%2Fdashboard%2Fcommercial%2Fclients%3Fq%3Dacero%26page%3D2`,
    );
    expect(withReturnTo(`${CLIENTS}/new`)).toBe(`${CLIENTS}/new`);
  });
});

describe("getSafeReturnTo", () => {
  it("devuelve una ruta interna del panel con su consulta intacta", () => {
    expect(getSafeReturnTo(`${CLIENTS}?q=andina&page=2`, FALLBACK)).toBe(`${CLIENTS}?q=andina&page=2`);
    expect(getSafeReturnTo("/dashboard", FALLBACK)).toBe("/dashboard");
    expect(getSafeReturnTo(`${CLIENTS}?page=2#CLI00000007`, FALLBACK)).toBe(`${CLIENTS}?page=2#CLI00000007`);
    expect(getSafeReturnTo([`${CLIENTS}?status=activo`, "/dashboard/otra"], FALLBACK)).toBe(`${CLIENTS}?status=activo`);
  });

  it.each([
    ["con & en un filtro", { q: "a&b" }],
    ["con % en un filtro", { q: "50%" }],
    ["con varios filtros y espacios", { q: "acero inox", status: "activo", page: "2" }],
  ])("conserva los filtros del listado en el viaje completo: %s", (_name, params) => {
    const { returnTo, back } = roundTrip(params);

    expect(back).toBe(returnTo);
  });

  it.each([
    ["vacio", ""],
    ["sin valor", undefined],
    ["URL absoluta", "https://example.com/phishing"],
    ["protocolo relativo", "//evil.example/dashboard"],
    ["barra invertida que el navegador lee como //", "/\\evil.example/dashboard"],
    ["esquema javascript", "javascript:alert(1)"],
    ["sin barra inicial", "dashboard/commercial/clients"],
    ["fuera del panel", "/api/reports/export/audit?format=xlsx"],
    ["un prefijo que no es el segmento /dashboard", "/dashboard.evil.example"],
    [".. que sale del panel hacia /api", "/dashboard/../api/reports/export/audit?format=xlsx"],
    ["../ codificado que sale del panel", "/dashboard%2F..%2Fapi%2Freports%2Fexport%2Faudit"],
  ])("rechaza %s y devuelve el destino seguro", (_name, value) => {
    expect(getSafeReturnTo(value, FALLBACK)).toBe(FALLBACK);
  });

  it("normaliza los segmentos . y .. que se quedan dentro del panel", () => {
    expect(getSafeReturnTo("/dashboard/./commercial/x/../clients?q=a", FALLBACK)).toBe(`${CLIENTS}?q=a`);
  });
});

describe("hasListFilters", () => {
  it("detecta filtros en la URL del listado, sin contar la paginacion", () => {
    expect(hasListFilters(`${CLIENTS}?status=inactivo&page=2`)).toBe(true);
    expect(hasListFilters(`${CLIENTS}?q=andina`)).toBe(true);
    expect(hasListFilters(`${CLIENTS}?page=2&pageSize=50`)).toBe(false);
    expect(hasListFilters(CLIENTS)).toBe(false);
    expect(hasListFilters(`${CLIENTS}?q=`)).toBe(false);
  });
});
