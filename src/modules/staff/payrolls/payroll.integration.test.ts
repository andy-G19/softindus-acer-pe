import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { registerOperatorPaymentAction } from "@/modules/staff/payment-history/actions";
import { cancelPayrollAction, generatePayrollAction } from "@/modules/staff/payrolls/actions";
import { getTestDatabase } from "@/testing/test-database";

// Planillas contra Postgres real (PGlite), C4 de la 11.5. Corre las acciones enteras: los
// candados del operario y de la planilla (su SQL se ejecuta de verdad sobre las tablas), los
// montos en centesimos (C2), los correlativos, la bitacora y el rollback de un rechazo. Solo se
// reemplazan la sesion y la cache de Next. Anular todavia redirige al guardar y lanza un error al
// rechazar: la prueba traduce lo primero a «guardado». Desde C6 y C7 de la 11.5 generar y pagar
// devuelven su resultado («guardado» o su error) y reclaman una clave nueva en cada envio.
//
// Lo que no se puede probar aqui: dos pagos o una anulacion y un pago simultaneos de la misma
// planilla. En Postgres el segundo espera el candado del primero y ve el estado final; PGlite
// atiende una sola transaccion a la vez (test-database.ts). Las repeticiones van una tras otra.

vi.mock("@/lib/authz", () => ({
  requireRole: async () => ({ user: { id: "USU00000001", name: "Andrea Prueba" } }),
  getAuthorizedSession: async () => ({ user: { id: "USU00000001", name: "Andrea Prueba" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const USUARIO = "USU00000001";
const OPERARIO = "OPE00000001";
const SAVED = "guardado";

let prisma: PrismaClient;

beforeAll(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

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
  await prisma.operario.create({
    data: {
      id_operario: OPERARIO,
      nombres: "Luis",
      apellidos: "Quispe",
      modalidad_pago: "semanal",
      tarifa: "50.00",
      estado: "activo",
    },
  });

  // Dos asistencias validas y una falta en cada semana de noviembre que usan las pruebas.
  const days = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-16", "2026-11-17"];

  await prisma.asistencia.createMany({
    data: days.map((day, index) => ({
      id_asistencia: `ASI${String(index + 1).padStart(8, "0")}`,
      id_operario: OPERARIO,
      id_usuario_registro: USUARIO,
      fecha: new Date(`${day}T00:00:00.000Z`),
      falta: day.endsWith("04") || day.endsWith("11"),
      horas_trabajadas: "8.00",
    })),
  });
});

/** Ejecuta la accion: «guardado» si redirige al terminar, o el mensaje del error. */
async function run(action: (formData: FormData) => Promise<void>, fields: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  try {
    await action(formData);

    return "termino sin redirigir";
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;

    return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")
      ? SAVED
      : error instanceof Error
        ? error.message
        : String(error);
  }
}

async function generate(periodo_inicio: string, periodo_fin: string, descuentos = "") {
  const formData = new FormData();

  for (const [key, value] of Object.entries({
    clave_operacion: randomUUID(),
    id_operario: OPERARIO,
    periodo_inicio,
    periodo_fin,
    descuentos,
  })) {
    formData.set(key, value);
  }

  const state = await generatePayrollAction({ status: "idle" }, formData);

  return state.status === "success" ? SAVED : state.status === "error" ? state.error : "sin respuesta";
}

async function pay(id_planilla: string, monto_pagado: string) {
  const formData = new FormData();

  for (const [key, value] of Object.entries({
    clave_operacion: randomUUID(),
    id_planilla,
    fecha_pago: "2026-11-20",
    monto_pagado,
    metodo_pago: "efectivo",
    observaciones: "",
  })) {
    formData.set(key, value);
  }

  const state = await registerOperatorPaymentAction({ status: "idle" }, formData);

  return state.status === "success" ? SAVED : state.status === "error" ? state.error : "sin respuesta";
}

const cancel = (id_planilla: string) => run(cancelPayrollAction, { id_planilla });

async function payrollOf(periodo_inicio: string) {
  return prisma.planilla_pago.findFirstOrThrow({
    where: { id_operario: OPERARIO, periodo_inicio: new Date(`${periodo_inicio}T00:00:00.000Z`) },
    select: { id_planilla: true, monto_bruto: true, descuentos: true, monto_neto: true, estado_pago: true },
  });
}

const paymentsOf = (id_planilla: string) => prisma.historial_pago_operario.count({ where: { id_planilla } });

const payrollCounter = async () =>
  (await prisma.correlativo_sistema.findUnique({ where: { codigo_entidad: "planilla_pago" } }))?.ultimo_numero ?? 0;

describe("planillas en Postgres", () => {
  it("genera una planilla que cuadra, y un periodo repetido no escribe nada ni gasta correlativo", async () => {
    expect(await generate("2026-11-02", "2026-11-08", "10.005")).toBe(SAVED);

    const payroll = await payrollOf("2026-11-02");

    expect([payroll.monto_bruto.toFixed(2), payroll.descuentos.toFixed(2), payroll.monto_neto.toFixed(2)]).toEqual([
      "100.00",
      "10.01",
      "89.99",
    ]);

    const counter = await payrollCounter();

    expect(await generate("2026-11-02", "2026-11-08")).toBe(
      "Este operario ya tiene una planilla generada para el periodo seleccionado.",
    );
    expect(await prisma.planilla_pago.count({ where: { id_operario: OPERARIO } })).toBe(1);
    expect(await payrollCounter()).toBe(counter);
  });

  it("pagar dos veces la misma planilla deja un solo pago", async () => {
    const { id_planilla } = await payrollOf("2026-11-02");

    expect(await pay(id_planilla, "89.99")).toBe(SAVED);
    expect(await pay(id_planilla, "89.99")).toBe("La planilla seleccionada ya fue pagada.");

    expect(await paymentsOf(id_planilla)).toBe(1);
    expect((await payrollOf("2026-11-02")).estado_pago).toBe("pagado");
  });

  it("una planilla pagada no se anula", async () => {
    const { id_planilla } = await payrollOf("2026-11-02");

    expect(await cancel(id_planilla)).toBe("No se puede anular una planilla que ya fue pagada.");
    expect((await payrollOf("2026-11-02")).estado_pago).toBe("pagado");
  });

  it("una planilla anulada no se paga ni se vuelve a anular", async () => {
    expect(await generate("2026-11-09", "2026-11-15")).toBe(SAVED);

    const { id_planilla } = await payrollOf("2026-11-09");

    expect(await cancel(id_planilla)).toBe(SAVED);
    expect(await pay(id_planilla, "100.00")).toBe("No se puede pagar una planilla anulada.");
    expect(await cancel(id_planilla)).toBe("La planilla ya se encuentra anulada.");

    expect(await paymentsOf(id_planilla)).toBe(0);
    expect((await payrollOf("2026-11-09")).estado_pago).toBe("anulada");
  });

  it("un pago distinto del neto no escribe nada", async () => {
    expect(await generate("2026-11-16", "2026-11-22")).toBe(SAVED);

    const { id_planilla } = await payrollOf("2026-11-16");

    expect(await pay(id_planilla, "100.01")).toBe(
      "Para esta versión MVP, el monto pagado debe coincidir con el monto neto de la planilla.",
    );
    expect(await paymentsOf(id_planilla)).toBe(0);
    expect((await payrollOf("2026-11-16")).estado_pago).toBe("pendiente");
  });

  // C5 de la 11.5 (D55): a esta altura el operario tiene la planilla PLA00000001 pagada (02 al 08),
  // PLA00000002 anulada (09 al 15) y PLA00000003 pendiente (16 al 22).
  it("un periodo que se cruza con una planilla pagada se rechaza y no escribe", async () => {
    const before = await prisma.planilla_pago.count({ where: { id_operario: OPERARIO } });

    expect(await generate("2026-11-05", "2026-11-12")).toBe(
      "Este operario ya tiene la planilla PLA00000001, del 02/11/2026 al 08/11/2026, que se cruza con el periodo seleccionado.",
    );
    expect(await prisma.planilla_pago.count({ where: { id_operario: OPERARIO } })).toBe(before);
  });

  it("compartir un solo dia con una planilla pendiente tambien es cruzarse", async () => {
    expect(await generate("2026-11-22", "2026-11-28")).toBe(
      "Este operario ya tiene la planilla PLA00000003, del 16/11/2026 al 22/11/2026, que se cruza con el periodo seleccionado.",
    );
  });

  it("un periodo que solo se cruza con una planilla anulada se genera", async () => {
    expect(await generate("2026-11-10", "2026-11-15")).toBe(SAVED);

    const payroll = await payrollOf("2026-11-10");

    // Una asistencia valida (el 10; el 11 es falta) por 50.00.
    expect([payroll.monto_bruto.toFixed(2), payroll.monto_neto.toFixed(2), payroll.estado_pago]).toEqual([
      "50.00",
      "50.00",
      "pendiente",
    ]);
  });
});
