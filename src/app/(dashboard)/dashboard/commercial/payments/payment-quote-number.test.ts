import { describe, expect, it, vi } from "vitest";

import {
  characterizePage,
  generatedResult,
  isPrismaCall,
  preloadPages,
  type PrismaArgs,
} from "@/testing/page-characterization";

vi.mock("server-only", () => ({}));
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

// C6 de la 11.3c (D41, hallazgo 2 de la auditoria de la 11.3c): pagos de cliente mostraba el id
// interno de la proforma (PRF00000004) en la columna «Proforma», y su buscador solo aceptaba ese
// id; el resto de la app la nombra por su numero (PF-00000004), como la confirmacion de anular
// desde el hallazgo 9 de la 11.3a. Ahora la columna muestra el numero y el buscador acepta los dos.

const loadPayments = () => import("./page");

preloadPages(loadPayments);

const ROUTE = "/dashboard/commercial/payments";

type Row = Record<string, unknown>;

function cellTexts(html: string | null) {
  expect(html).not.toBeNull();

  return [...(html ?? "").matchAll(/<td>([^<]*)<\/td>/g)].map((match) => match[1]);
}

describe("C6 de la 11.3c: pagos de cliente nombran la proforma por su numero", () => {
  it("la columna «Proforma» muestra el numero, no el id interno", async () => {
    const payments = (args: PrismaArgs) => {
      const [first] = generatedResult("pago_cliente", "findMany", args) as Row[];
      const quote = first.proforma as Row;

      return [
        {
          ...first,
          id_proforma: "PRF00000004",
          proforma: { ...quote, numero_proforma: "PF-00000004" },
        },
      ];
    };

    const { html } = await characterizePage(
      loadPayments,
      { name: "numero", data: { "pago_cliente.findMany": payments } },
      ROUTE,
    );
    const cells = cellTexts(html);

    expect(cells).toContain("PF-00000004");
    expect(cells).not.toContain("PRF00000004");
  });

  it("el buscador acepta el numero de la proforma, y sigue aceptando su id", async () => {
    const { calls } = await characterizePage(
      loadPayments,
      { name: "busqueda", searchParams: { q: "PF-0000" } },
      ROUTE,
    );
    const list = calls.filter(isPrismaCall).find((call) => call.prisma === "pago_cliente.findMany");
    const where = JSON.stringify((list?.args as { where?: unknown }).where);

    expect(where).toContain('{"proforma":{"numero_proforma":{"contains":"PF-0000","mode":"insensitive"}}}');
    expect(where).toContain('{"id_proforma":{"contains":"PF-0000","mode":"insensitive"}}');
  });
});
