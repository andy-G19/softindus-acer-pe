import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { characterizePage } from "@/testing/page-characterization";

vi.mock("server-only", () => ({}));
vi.mock("@/components/navigation/route-sheet", () => ({
  RouteSheet: ({ children }: { children: ReactNode }) => createElement("section", null, children),
}));
// El returnTo del panel solo se nota al guardar: el doble lo deja a la vista.
vi.mock("@/modules/waste-scrap/scraps/scrap-form", () => ({
  ScrapForm: ({ returnTo }: { returnTo: string }) => createElement("output", null, returnTo),
}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock(),
);
vi.mock("@/lib/authz", async () =>
  (await import("@/testing/page-characterization")).authzModuleMock(),
);
vi.mock("next/navigation", async (importOriginal) =>
  (await import("@/testing/page-characterization")).navigationModuleMock(
    await importOriginal(),
  ),
);

const LIST = "/dashboard/waste-scrap/scraps";

async function panelReturnTo(returnTo?: string) {
  const { html } = await characterizePage(
    () => import("./@panel/(.)new/page"),
    { name: "panel", searchParams: returnTo ? { returnTo } : {} },
    `${LIST}/new`,
  );

  return /<output>(.*?)<\/output>/.exec(html ?? "")?.[1]?.replaceAll("&amp;", "&");
}

describe("returnTo del panel de chatarra", () => {
  it("conserva los filtros de la lista que lo abrio", async () => {
    expect(await panelReturnTo(`${LIST}?estado=vendida`)).toBe(`${LIST}?estado=vendida`);
  });

  it("sin returnTo vuelve a la lista", async () => {
    expect(await panelReturnTo()).toBe(LIST);
  });

  it("un returnTo ajeno vuelve a la lista", async () => {
    expect(await panelReturnTo("https://otro.example/x")).toBe(LIST);
  });
});
