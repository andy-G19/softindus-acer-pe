import { describe, expect, it, vi } from "vitest";

import { getNewRecipeVersionData, getRecipeVersionsData } from "@/modules/production/recipe-versions/queries";
import { characterizeHandler } from "@/testing/page-characterization";

// B2 (hallazgo 4 de la auditoria de la 10.6): fecha_version es @db.Date, asi que
// dos versiones del mismo dia empatan y la base las devolveria en cualquier orden.
// Decide el correlativo, que siempre crece.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => (await import("@/testing/page-characterization")).dbModuleMock());

const ORDEN = [{ fecha_version: "desc" }, { id_version_receta: "desc" }];

type RecipeRead = { args: { include: { version_receta: { orderBy: unknown } } } };

const recipeRead = (calls: unknown[]) =>
  calls.find((call) => (call as { prisma?: string }).prisma === "receta_tecnica.findUnique") as RecipeRead;

describe("el orden de las versiones con la misma fecha", () => {
  it("el historial pone primero la de correlativo mas alto", async () => {
    const { calls } = await characterizeHandler(() => getRecipeVersionsData("REC00000001"));

    expect(recipeRead(calls).args.include.version_receta.orderBy).toEqual(ORDEN);
  });

  it("la nueva version copia la de correlativo mas alto", async () => {
    const { calls } = await characterizeHandler(() => getNewRecipeVersionData("REC00000001"));

    expect(recipeRead(calls).args.include.version_receta.orderBy).toEqual(ORDEN);
  });
});
