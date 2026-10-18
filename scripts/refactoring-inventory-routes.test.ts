import { describe, expect, it } from "vitest";

import { describeRoute } from "./refactoring-inventory-routes.mjs";

// URL de cada pagina en el inventario de refactor (entrega 10.3). Los casos
// siguen la convencion de Next 16 (docs de intercepting-routes y
// parallel-routes): los grupos y las ranuras no son segmentos de la URL, y
// (.), (..), (..)(..) y (...) cuentan segmentos de ruta, no carpetas.

const CLIENTS = "src/app/(dashboard)/dashboard/commercial/clients";

describe("describeRoute", () => {
  it("quita los grupos de la URL", () => {
    expect(describeRoute("src/app/(dashboard)/dashboard/inventory/materials/page.tsx")).toEqual({
      route: "/dashboard/inventory/materials",
      slot: null,
      intercepted: false,
    });
    expect(describeRoute("src/app/(auth)/login/page.tsx")).toEqual({
      route: "/login",
      slot: null,
      intercepted: false,
    });
  });

  it("la pagina de la raiz es /", () => {
    expect(describeRoute("src/app/page.tsx")).toEqual({ route: "/", slot: null, intercepted: false });
  });

  it("conserva los segmentos dinamicos", () => {
    expect(describeRoute(`${CLIENTS}/[id]/edit/page.tsx`)).toEqual({
      route: "/dashboard/commercial/clients/[id]/edit",
      slot: null,
      intercepted: false,
    });
  });

  it("la ranura no es parte de la URL y se anota", () => {
    expect(describeRoute(`${CLIENTS}/@panel/page.tsx`)).toEqual({
      route: "/dashboard/commercial/clients",
      slot: "@panel",
      intercepted: false,
    });
  });

  it("(.) intercepta el segmento del mismo nivel de ruta", () => {
    expect(describeRoute(`${CLIENTS}/@panel/(.)new/page.tsx`)).toEqual({
      route: "/dashboard/commercial/clients/new",
      slot: "@panel",
      intercepted: true,
    });
    expect(describeRoute(`${CLIENTS}/@panel/(.)[id]/edit/page.tsx`)).toEqual({
      route: "/dashboard/commercial/clients/[id]/edit",
      slot: "@panel",
      intercepted: true,
    });
  });

  it("(..) sube un segmento de ruta: la ranura no cuenta como nivel", () => {
    expect(describeRoute("src/app/feed/@modal/(..)photo/[id]/page.tsx")).toEqual({
      route: "/photo/[id]",
      slot: "@modal",
      intercepted: true,
    });
  });

  it("(..)(..) sube dos segmentos y (...) parte de la raiz", () => {
    expect(describeRoute("src/app/(dashboard)/dashboard/a/b/(..)(..)c/page.tsx")).toEqual({
      route: "/dashboard/c",
      slot: null,
      intercepted: true,
    });
    expect(describeRoute("src/app/(dashboard)/dashboard/a/@panel/(...)login/page.tsx")).toEqual({
      route: "/login",
      slot: "@panel",
      intercepted: true,
    });
  });
});
