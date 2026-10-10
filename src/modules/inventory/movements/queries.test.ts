import { describe, expect, it, vi } from "vitest";

import { getInventoryOutputFormOptions } from "@/modules/inventory/movements/queries";
import { characterizeHandler, isPrismaCall } from "@/testing/page-characterization";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock(),
);

// H9 (grupo 1 de fixes): el formulario de salida solo ofrece las ordenes que
// admiten material, con la misma regla que valida la accion. Antes excluia
// "cancelada", un estado que no existe, y ofrecia las ordenes anuladas y las
// de materiales cerrados.
describe("getInventoryOutputFormOptions", () => {
  it("ofrece solo ordenes no anuladas ni finalizadas y con los materiales abiertos", async () => {
    const { calls } = await characterizeHandler(() => getInventoryOutputFormOptions());
    const workOrders = calls
      .filter(isPrismaCall)
      .find((call) => call.prisma === "orden_trabajo.findMany");

    expect(workOrders?.args).toMatchObject({
      where: {
        estado: { notIn: ["finalizada", "anulada"] },
        fecha_cierre_materiales: null,
      },
    });
  });
});
