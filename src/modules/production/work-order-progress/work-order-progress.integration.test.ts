import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  generateWorkOrderProgressAction,
  updateWorkOrderProgressAction,
} from "@/modules/production/work-order-progress/actions";
import { getTestDatabase } from "@/testing/test-database";

// Avances de una orden de trabajo contra Postgres real (PGlite), C2 de la 11.6c (D79). Corre la
// accion entera: el candado de la orden, el avance, la sincronizacion del estado de la orden y la
// bitacora. Solo se reemplazan la sesion, la cache de Next y la redireccion, que corta la accion
// al terminar bien. Desde C3, generar devuelve su estado (runState) y no redirige.
//
// porcentaje_avance es numeric(5, 2) y redondea por su lado: la regla «en proceso o pausada, mas de
// 0 y menos de 100» se aplicaba al numero sin redondear, y 99.995 quedaba guardado como 100.00 en
// una etapa en proceso.

vi.mock("@/lib/authz", () => ({
  requireRole: async () => ({ user: { id: "USU00000001", name: "Andrea Prueba" } }),
  getAuthorizedSession: async () => ({ user: { id: "USU00000001", name: "Andrea Prueba" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

const USUARIO = "USU00000001";
const PRODUCTO = "PRO00000001";
const RUTA = "RUT00000001";

let prisma: PrismaClient;

beforeAll(async () => {
  ({ prisma } = await getTestDatabase());

  await prisma.rol.create({ data: { id_rol: "ROL00000001", nombre_rol: "ADMIN" } });
  await prisma.usuario.create({
    data: {
      id_usuario: USUARIO,
      id_rol: "ROL00000001",
      nombres: "Andrea",
      apellidos: "Prueba",
      usuario: "andrea",
      clave_hash: "sin-uso",
    },
  });
  await prisma.producto.create({
    data: { id_producto: PRODUCTO, nombre_producto: "Puerta de prueba", categoria: "puertas", unidad_medida: "unidad" },
  });
  await prisma.ruta_fabricacion.create({
    data: { id_ruta: RUTA, id_producto: PRODUCTO, nombre_ruta: "Ruta de prueba" },
  });
  await prisma.etapa_ruta.createMany({
    data: [
      { id_etapa_ruta: "ETR00000001", id_ruta: RUTA, nombre_etapa: "Corte", orden_secuencia: 1 },
      { id_etapa_ruta: "ETR00000002", id_ruta: RUTA, nombre_etapa: "Soldadura", orden_secuencia: 2 },
    ],
  });
});

/**
 * Una orden pendiente con sus dos avances pendientes, o sin avances; devuelve el avance de la
 * primera etapa.
 */
async function seedOrder(suffix: string, { avances = true }: { avances?: boolean } = {}) {
  const idOrden = `OTR${suffix.padStart(8, "0")}`;
  const idAvance = `AVN${suffix.padStart(7, "0")}1`;

  await prisma.orden_trabajo.create({
    data: {
      id_orden_trabajo: idOrden,
      id_producto: PRODUCTO,
      id_ruta: RUTA,
      tipo_produccion: "reposicion_stock",
      cantidad: "1.00",
      fecha_inicio: new Date("2026-11-10T00:00:00.000Z"),
      estado: "pendiente",
      id_usuario_registro: USUARIO,
    },
  });
  if (!avances) {
    return { idOrden, idAvance };
  }

  await prisma.avance_orden.createMany({
    data: [
      { id_avance: idAvance, id_orden_trabajo: idOrden, id_etapa_ruta: "ETR00000001", id_usuario_actualiza: USUARIO },
      {
        id_avance: `AVN${suffix.padStart(7, "0")}2`,
        id_orden_trabajo: idOrden,
        id_etapa_ruta: "ETR00000002",
        id_usuario_actualiza: USUARIO,
      },
    ],
  });

  return { idOrden, idAvance };
}

async function update(fields: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  await expect(updateWorkOrderProgressAction(formData)).rejects.toThrow(/^redirect:/);
}

async function stored(idOrden: string, idAvance: string) {
  const advance = await prisma.avance_orden.findUniqueOrThrow({ where: { id_avance: idAvance } });
  const order = await prisma.orden_trabajo.findUniqueOrThrow({ where: { id_orden_trabajo: idOrden } });

  return { etapa: advance.estado_etapa, porcentaje: advance.porcentaje_avance.toFixed(2), orden: order.estado };
}

describe("C2 de la 11.6c: el porcentaje en centesimos antes de la regla", () => {
  it.each([
    ["1", "en_proceso", "99.995", "99.00", "en_proceso"],
    ["2", "pausada", "99.995", "99.00", "pausada"],
    ["3", "en_proceso", "0.004", "1.00", "en_proceso"],
    ["4", "en_proceso", "45.678", "45.68", "en_proceso"],
  ])("orden %s: %s con %s guarda %s y la orden queda %s", async (suffix, estado, porcentaje, guardado, orden) => {
    const { idOrden, idAvance } = await seedOrder(suffix);

    await update({ id_avance: idAvance, estado_etapa: estado, porcentaje_avance: porcentaje, observaciones: "" });

    expect(await stored(idOrden, idAvance)).toEqual({ etapa: estado, porcentaje: guardado, orden });
  });
});

describe("C3 de la 11.6c: generar con resultado", () => {
  async function runState(fields: Record<string, string>) {
    const formData = new FormData();

    for (const [key, value] of Object.entries(fields)) {
      formData.set(key, value);
    }

    return generateWorkOrderProgressAction({ status: "idle" }, formData);
  }

  it("un segundo envio responde que ya hay avances y no crea otro juego", async () => {
    const { idOrden } = await seedOrder("5", { avances: false });

    expect(await runState({ id_orden_trabajo: idOrden })).toMatchObject({
      status: "success",
      data: { estado: "generado" },
    });
    expect(await runState({ id_orden_trabajo: idOrden })).toMatchObject({
      status: "error",
      error: "Esta orden ya tiene avances generados.",
    });

    const advances = await prisma.avance_orden.findMany({
      where: { id_orden_trabajo: idOrden },
      include: { etapa_ruta: { select: { orden_secuencia: true } } },
    });
    const order = await prisma.orden_trabajo.findUniqueOrThrow({ where: { id_orden_trabajo: idOrden } });

    expect(
      advances
        .map((advance) => [advance.etapa_ruta.orden_secuencia, advance.estado_etapa, advance.porcentaje_avance.toFixed(2)])
        .sort(),
    ).toEqual([
      [1, "pendiente", "0.00"],
      [2, "pendiente", "0.00"],
    ]);
    expect(order.estado).toBe("pendiente");
  });
});
