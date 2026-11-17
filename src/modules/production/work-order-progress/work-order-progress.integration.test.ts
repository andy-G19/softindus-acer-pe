import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  generateWorkOrderProgressAction,
  reassignWorkOrderProgressAction,
  updateWorkOrderProgressAction,
} from "@/modules/production/work-order-progress/actions";
import { getTestDatabase } from "@/testing/test-database";

// Avances de una orden de trabajo contra Postgres real (PGlite), C2 de la 11.6c (D79). Corre la
// accion entera: el candado de la orden, el avance, la sincronizacion del estado de la orden y la
// bitacora. Solo se reemplazan la sesion, la cache de Next y la redireccion, que corta la accion
// al terminar bien. Desde C3, generar devuelve su estado (runState) y no redirige; desde C4,
// actualizar tambien (update), y desde C5 reasignar (reassign).
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

  return updateWorkOrderProgressAction({ status: "idle" }, formData);
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

    expect(
      await update({ id_avance: idAvance, estado_etapa: estado, porcentaje_avance: porcentaje, observaciones: "" }),
    ).toMatchObject({ status: "success" });

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

describe("C4 de la 11.6c: actualizar una etapa con resultado", () => {
  it("terminar la ultima etapa finaliza la orden (D83); despues ya no se puede modificar y no escribe", async () => {
    const { idOrden, idAvance } = await seedOrder("6");
    const segundo = `${idAvance.slice(0, -1)}2`;
    const terminar = (id: string) =>
      update({ id_avance: id, estado_etapa: "terminada", porcentaje_avance: "40", observaciones: "" });

    expect(await terminar(idAvance)).toMatchObject({ status: "success", data: { id_avance: idAvance, id_orden_trabajo: idOrden } });
    // Con la otra etapa pendiente, la orden queda pendiente: no hay ninguna en proceso ni pausada.
    expect(await stored(idOrden, idAvance)).toEqual({ etapa: "terminada", porcentaje: "100.00", orden: "pendiente" });
    expect(await terminar(segundo)).toMatchObject({ status: "success" });
    expect(await stored(idOrden, segundo)).toEqual({ etapa: "terminada", porcentaje: "100.00", orden: "finalizada" });

    expect(
      await update({ id_avance: idAvance, estado_etapa: "en_proceso", porcentaje_avance: "50", observaciones: "Reabrir" }),
    ).toMatchObject({
      status: "error",
      error: "No se puede modificar el avance de una orden anulada o finalizada.",
      values: { estado_etapa: "en_proceso", porcentaje_avance: "50", observaciones: "Reabrir" },
    });
    expect(await stored(idOrden, idAvance)).toEqual({ etapa: "terminada", porcentaje: "100.00", orden: "finalizada" });
    expect(
      await prisma.bitacora_operacion.count({ where: { id_registro_afectado: { in: [idAvance, segundo] }, accion: "actualizar" } }),
    ).toBe(2);
  });
});

describe("C5 de la 11.6c: reasignar con resultado", () => {
  async function reassign(fields: Record<string, string>) {
    const formData = new FormData();

    for (const [key, value] of Object.entries(fields)) {
      formData.set(key, value);
    }

    return reassignWorkOrderProgressAction({ status: "idle" }, formData);
  }

  it("un segundo envio con el mismo operario se rechaza en su campo y no registra otra reasignacion", async () => {
    await prisma.operario.create({
      data: { id_operario: "OPE00000071", nombres: "Rosa", apellidos: "Huaman", modalidad_pago: "jornal" },
    });
    const { idAvance } = await seedOrder("7");
    const fields = { id_avance: idAvance, id_operario_nuevo: "OPE00000071", motivo: "Cambio de turno" };

    expect(await reassign(fields)).toMatchObject({ status: "success", data: { id_avance: idAvance } });
    expect(await reassign(fields)).toMatchObject({
      status: "error",
      error: "El nuevo operario debe ser distinto al operario actual.",
      fieldErrors: { id_operario_nuevo: ["El nuevo operario debe ser distinto al operario actual."] },
      values: { id_operario_nuevo: "OPE00000071", motivo: "Cambio de turno" },
    });

    const advance = await prisma.avance_orden.findUniqueOrThrow({ where: { id_avance: idAvance } });
    const reassignments = await prisma.reasignacion_tarea.findMany({ where: { id_avance: idAvance } });

    expect(advance.id_operario).toBe("OPE00000071");
    expect(reassignments.map((item) => [item.id_operario_anterior, item.id_operario_nuevo, item.motivo])).toEqual([
      [null, "OPE00000071", "Cambio de turno"],
    ]);
  });
});
