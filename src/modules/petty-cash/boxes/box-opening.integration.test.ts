import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { createPettyCashBoxAction } from "@/modules/petty-cash/boxes/actions";
import { getTestDatabase } from "@/testing/test-database";

// Abrir una caja chica contra Postgres real (PGlite), C1 del grupo de fixes (D123). La accion busca
// el nombre dentro de su transaccion, despues de reservar el correlativo de caja: si el nombre ya
// existe, la transaccion se revierte y el contador queda como estaba (no se pierde un numero). Con
// el codigo anterior el contador tampoco avanzaba, porque buscaba antes de reservar; esta prueba
// protege que el rechazo se lance y no se devuelva desde la transaccion, lo que confirmaria la
// reserva. Solo se reemplazan la sesion y la cache de Next.
//
// Lo que no se puede probar aqui: dos aperturas simultaneas con el mismo nombre. En Postgres la
// segunda espera el bloqueo del correlativo y despues ve la primera; PGlite atiende una sola
// transaccion a la vez (test-database.ts). Las aperturas van una tras otra.

vi.mock("@/lib/authz", () => ({
  getAuthorizedSession: async () => ({ user: { id: "USU00000001", name: "Andrea Prueba" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

let prisma: PrismaClient;

beforeAll(async () => {
  ({ prisma } = await getTestDatabase());
});

function boxForm(nombre: string) {
  const formData = new FormData();

  formData.append("nombre_caja", nombre);
  formData.append("saldo_inicial", "100.00");
  formData.append("fecha_apertura", "2026-11-19");
  formData.append("responsable", "");
  formData.append("observaciones", "");

  return formData;
}

async function counter() {
  const row = await prisma.correlativo_sistema.findUniqueOrThrow({
    where: { codigo_entidad: "caja_chica" },
    select: { ultimo_numero: true },
  });

  return row.ultimo_numero;
}

describe("apertura de caja chica en Postgres", () => {
  it("abre la caja nueva con el siguiente numero", async () => {
    const result = await createPettyCashBoxAction({ status: "idle" }, boxForm("Caja de obra norte"));

    expect(result.status).toBe("success");
    expect(await prisma.caja_chica.count({ where: { nombre_caja: "Caja de obra norte" } })).toBe(1);
  });

  it("con el mismo nombre en otras mayusculas no la abre y el contador no avanza", async () => {
    const antes = await counter();

    const result = await createPettyCashBoxAction({ status: "idle" }, boxForm("  CAJA DE OBRA NORTE "));

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { nombre_caja: ["Ya existe una caja chica con ese nombre."] },
    });
    expect(await counter()).toBe(antes);
    expect(
      await prisma.caja_chica.count({ where: { nombre_caja: { equals: "caja de obra norte", mode: "insensitive" } } }),
    ).toBe(1);
  });
});
