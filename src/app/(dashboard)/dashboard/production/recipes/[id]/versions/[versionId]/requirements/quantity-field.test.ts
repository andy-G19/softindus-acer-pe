// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MaterialRequirementsPage from "./page";

// La cantidad de los requerimientos sigue a la URL (hallazgo 9 de la auditoria de la
// 10.6). Next no remonta la pagina al cambiar la consulta y un input solo lee
// defaultValue al montarse: al volver con Atras quedaba la cantidad vieja junto a
// KPI de otra cantidad. La prueba pinta la pagina real dos veces sobre la misma raiz,
// que es lo que hace Next.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({ requireRole: async () => ({ user: { id: "USR00000001" } }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  usePathname: () => "/dashboard/production/recipes",
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/modules/production/recipe-versions/queries", () => ({
  getMaterialRequirementsVersion: async () => ({
    id_receta: "REC00000001",
    id_version_receta: "VER00000001",
    numero_version: "V1",
    estado: "vigente",
    receta_tecnica: { nombre_receta: "Reja", estado: "activa", producto: { nombre_producto: "Reja" } },
    detalle_receta: [],
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function renderAt(quantity?: string) {
  const page = await MaterialRequirementsPage({
    params: Promise.resolve({ id: "REC00000001", versionId: "VER00000001" }),
    searchParams: Promise.resolve({ quantity }),
  });

  await act(async () => root.render(page));
}

const quantityInput = () => document.querySelector<HTMLInputElement>('input[name="quantity"]')!;

describe("cantidad a fabricar", () => {
  it("toma la cantidad de la URL al cambiar la consulta", async () => {
    await renderAt("25");
    expect(quantityInput().value).toBe("25");

    await renderAt("7");
    expect(quantityInput().value).toBe("7");
  });

  it("sin cantidad en la URL vuelve a una unidad", async () => {
    await renderAt("25");
    await renderAt(undefined);

    expect(quantityInput().value).toBe("1");
  });

  it("una cantidad invalida muestra la unidad con la que se calcula", async () => {
    await renderAt("25");
    await renderAt("abc");

    expect(quantityInput().value).toBe("1");
  });

  it("la etiqueta y la ayuda estan asociadas al campo", async () => {
    await renderAt();

    const input = quantityInput();

    expect(document.querySelector('label[for="quantity"]')?.textContent).toContain("Cantidad a fabricar");
    expect(document.getElementById(input.getAttribute("aria-describedby") ?? "")?.textContent).toContain(
      "multiplicará los materiales",
    );
    expect(input.required).toBe(true);
  });

  it("no abre otro main", async () => {
    await renderAt();

    expect(host.querySelector("main")).toBeNull();
  });
});
