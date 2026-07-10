import { describe, expect, it } from "vitest";

import { APP_ROLES, canAccessDashboardRoute } from "@/lib/permissions";

describe("canAccessDashboardRoute", () => {
  it("permite a ADMIN acceder a rutas de todos los modulos", () => {
    expect(canAccessDashboardRoute(APP_ROLES.ADMIN, "/dashboard")).toBe(true);
    expect(canAccessDashboardRoute(APP_ROLES.ADMIN, "/dashboard/users")).toBe(true);
    expect(canAccessDashboardRoute(APP_ROLES.ADMIN, "/dashboard/commercial")).toBe(true);
    expect(canAccessDashboardRoute(APP_ROLES.ADMIN, "/dashboard/inventory")).toBe(true);
    expect(canAccessDashboardRoute(APP_ROLES.ADMIN, "/dashboard/production")).toBe(true);
    expect(canAccessDashboardRoute(APP_ROLES.ADMIN, "/dashboard/costs")).toBe(true);
    expect(canAccessDashboardRoute(APP_ROLES.ADMIN, "/dashboard/petty-cash")).toBe(true);
    expect(canAccessDashboardRoute(APP_ROLES.ADMIN, "/dashboard/reports")).toBe(true);
  });

  it("permite a SELLER acceder solo a rutas comerciales y comunes", () => {
    expect(canAccessDashboardRoute(APP_ROLES.SELLER, "/dashboard")).toBe(true);
    expect(canAccessDashboardRoute(APP_ROLES.SELLER, "/dashboard/commercial")).toBe(true);
    expect(
      canAccessDashboardRoute(APP_ROLES.SELLER, "/dashboard/commercial/clients"),
    ).toBe(true);
    expect(
      canAccessDashboardRoute(APP_ROLES.SELLER, "/dashboard/reports/sales-collections"),
    ).toBe(true);
  });

  it("no permite a SELLER acceder a inventario, produccion ni administracion", () => {
    expect(canAccessDashboardRoute(APP_ROLES.SELLER, "/dashboard/inventory")).toBe(false);
    expect(canAccessDashboardRoute(APP_ROLES.SELLER, "/dashboard/production")).toBe(false);
    expect(canAccessDashboardRoute(APP_ROLES.SELLER, "/dashboard/users")).toBe(false);
    expect(canAccessDashboardRoute(APP_ROLES.SELLER, "/dashboard/costs")).toBe(false);
  });

  it("permite a WORKSHOP_MASTER acceder a inventario y produccion", () => {
    expect(canAccessDashboardRoute(APP_ROLES.WORKSHOP_MASTER, "/dashboard/inventory")).toBe(
      true,
    );
    expect(
      canAccessDashboardRoute(APP_ROLES.WORKSHOP_MASTER, "/dashboard/production"),
    ).toBe(true);
    expect(
      canAccessDashboardRoute(
        APP_ROLES.WORKSHOP_MASTER,
        "/dashboard/reports/inventory",
      ),
    ).toBe(true);
  });

  it("no permite a WORKSHOP_MASTER acceder a comercial ni al listado general de reportes", () => {
    expect(
      canAccessDashboardRoute(APP_ROLES.WORKSHOP_MASTER, "/dashboard/commercial"),
    ).toBe(false);
    expect(canAccessDashboardRoute(APP_ROLES.WORKSHOP_MASTER, "/dashboard/reports")).toBe(
      false,
    );
    expect(canAccessDashboardRoute(APP_ROLES.WORKSHOP_MASTER, "/dashboard/users")).toBe(
      false,
    );
  });

  it("devuelve false para un rol no reconocido por el sistema", () => {
    expect(canAccessDashboardRoute("GUEST", "/dashboard")).toBe(false);
    expect(canAccessDashboardRoute("", "/dashboard")).toBe(false);
  });

  it("una subruta no registrada bajo /dashboard hereda los permisos del dashboard general", () => {
    // No hay una entrada especifica para "/dashboard/no-existe": al empezar
    // con "/dashboard/" cae en la regla general de "/dashboard" (todos los
    // roles), que es el comportamiento actual del matcher por prefijo.
    expect(canAccessDashboardRoute(APP_ROLES.ADMIN, "/dashboard/no-existe")).toBe(true);
    expect(canAccessDashboardRoute(APP_ROLES.SELLER, "/dashboard/no-existe")).toBe(true);
  });

  it("devuelve false para rutas totalmente fuera de /dashboard", () => {
    expect(canAccessDashboardRoute(APP_ROLES.ADMIN, "/otra-cosa")).toBe(false);
    expect(canAccessDashboardRoute(APP_ROLES.SELLER, "/login")).toBe(false);
  });

  it("normaliza barras finales sin cambiar el resultado", () => {
    expect(canAccessDashboardRoute(APP_ROLES.SELLER, "/dashboard/commercial/")).toBe(true);
  });
});
