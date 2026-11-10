import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { createPurchaseAction } from "@/modules/inventory/purchases/actions";
import { getTestDatabase } from "@/testing/test-database";

// Crear compra contra Postgres real (PGlite), 11.2b. Corre la accion entera: la clave de la
// operacion, las lecturas dentro de la transaccion, los correlativos, la suma atomica del
// stock, el kardex, el historial de precios, la bitacora y el rollback de un rechazo. Solo se
// reemplazan la sesion y la cache de Next.
//
// Lo que no se puede probar aqui: dos envios simultaneos con la misma clave. En Postgres el
// segundo INSERT de la clave espera al primero y lo ve repetido; PGlite atiende una sola
// transaccion a la vez (test-database.ts). Los reenvios van uno tras otro, que es el caso de
// una respuesta perdida.

vi.mock("@/lib/authz", () => ({
  requireRole: async () => ({ user: { id: "USU00000001" } }),
  getAuthorizedSession: async () => ({ user: { id: "USU00000001" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const USUARIO = "USU00000001";
const PROVEEDOR = "PVE00000001";
const PROVEEDOR_INACTIVO = "PVE00000002";
const PLANCHA = "MAT00000001";
const TUBO = "MAT00000002";

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
  await prisma.proveedor.createMany({
    data: [
      { id_proveedor: PROVEEDOR, razon_social: "Aceros del Sur", tipo_proveedor: "material" },
      { id_proveedor: PROVEEDOR_INACTIVO, razon_social: "Proveedor dado de baja", tipo_proveedor: "material", estado: false },
    ],
  });
  await prisma.material.createMany({
    data: [
      { id_material: PLANCHA, nombre_material: "Plancha 3 mm", categoria: "plancha", unidad_medida: "UND", stock_actual: "10" },
      { id_material: TUBO, nombre_material: "Tubo 2 pulgadas", categoria: "tubo", unidad_medida: "m", stock_actual: "4" },
    ],
  });
});

type Line = { id_material: string; cantidad: string; costo_unitario: string };

function purchaseForm(
  lines: Line[],
  { clave = randomUUID(), proveedor = PROVEEDOR, numero = "" }: { clave?: string; proveedor?: string; numero?: string } = {},
) {
  const formData = new FormData();

  formData.set("id_proveedor", proveedor);
  formData.set("clave_operacion", clave);
  formData.set("fecha_compra", "2026-07-14");
  formData.set("tipo_comprobante", numero ? "factura" : "");
  formData.set("numero_comprobante", numero);
  if (numero) {
    formData.set("aplica_igv", "on");
  }
  formData.set("observaciones", "");

  for (const line of lines) {
    formData.append("id_material", line.id_material);
    formData.append("cantidad", line.cantidad);
    formData.append("unidad_medida", "UND");
    formData.append("costo_unitario", line.costo_unitario);
    formData.append("item_observaciones", "");
  }

  return formData;
}

const stockOf = async (id_material: string) =>
  (await prisma.material.findUniqueOrThrow({ where: { id_material }, select: { stock_actual: true } })).stock_actual.toFixed(2);

describe("crear compra en Postgres", () => {
  it("guarda montos que cuadran, suma el stock y deja el kardex y el historial", async () => {
    const state = await createPurchaseAction(
      { status: "idle" },
      purchaseForm(
        [
          { id_material: PLANCHA, cantidad: "1.25", costo_unitario: "10.25" },
          { id_material: TUBO, cantidad: "1.25", costo_unitario: "10.25" },
        ],
        { numero: "F001-000901" },
      ),
    );

    expect(state).toMatchObject({ status: "success" });

    const idCompra = (state as { data: { id_compra: string } }).data.id_compra;
    const compra = await prisma.compra.findUniqueOrThrow({ where: { id_compra: idCompra } });
    const lines = await prisma.detalle_compra.findMany({ where: { id_compra: idCompra }, orderBy: { id_detalle_compra: "asc" } });
    const kardex = await prisma.movimiento_inventario.findMany({ where: { id_compra: idCompra }, orderBy: { id_movimiento: "asc" } });

    expect({
      subtotal: compra.subtotal.toFixed(2),
      igv: compra.igv?.toFixed(2),
      total: compra.monto_total.toFixed(2),
    }).toEqual({ subtotal: "25.62", igv: "4.61", total: "30.23" });
    expect(lines.map((line) => line.subtotal.toFixed(2))).toEqual(["12.81", "12.81"]);
    expect(await stockOf(PLANCHA)).toBe("11.25");
    expect(await stockOf(TUBO)).toBe("5.25");
    expect(kardex.map((row) => [row.cantidad.toFixed(2), row.stock_anterior.toFixed(2), row.stock_resultante.toFixed(2)])).toEqual([
      ["1.25", "10.00", "11.25"],
      ["1.25", "4.00", "5.25"],
    ]);
    expect(await prisma.historial_precio_proveedor.count({ where: { id_compra: idCompra } })).toBe(2);
  });

  it("la misma clave dos veces deja una sola compra y una sola entrada de stock", async () => {
    const clave = randomUUID();
    const before = await stockOf(PLANCHA);
    const comprasAntes = await prisma.compra.count();

    const first = await createPurchaseAction(
      { status: "idle" },
      purchaseForm([{ id_material: PLANCHA, cantidad: "2", costo_unitario: "8" }], { clave }),
    );
    const second = await createPurchaseAction(
      { status: "idle" },
      purchaseForm([{ id_material: PLANCHA, cantidad: "2", costo_unitario: "8" }], { clave }),
    );

    expect(first).toMatchObject({ status: "success", data: { clave_operacion: clave } });
    expect(second).toMatchObject({ status: "success", data: (first as { data: unknown }).data });
    expect(await prisma.compra.count()).toBe(comprasAntes + 1);
    expect(Number(await stockOf(PLANCHA))).toBe(Number(before) + 2);
    expect(
      await prisma.operacion_idempotente.findUnique({
        where: { clave },
        select: { tipo_operacion: true, id_registro_resultado: true },
      }),
    ).toEqual({
      tipo_operacion: "crear_compra",
      id_registro_resultado: (first as { data: { id_compra: string } }).data.id_compra,
    });
  });

  it("un proveedor inactivo se rechaza en su campo, no escribe nada y libera la clave", async () => {
    const clave = randomUUID();
    const before = await stockOf(PLANCHA);
    const comprasAntes = await prisma.compra.count();

    const state = await createPurchaseAction(
      { status: "idle" },
      purchaseForm([{ id_material: PLANCHA, cantidad: "1", costo_unitario: "5" }], { clave, proveedor: PROVEEDOR_INACTIVO }),
    );

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { id_proveedor: ["El proveedor seleccionado no existe o está inactivo."] },
    });
    expect(await prisma.compra.count()).toBe(comprasAntes);
    expect(await stockOf(PLANCHA)).toBe(before);
    expect(await prisma.operacion_idempotente.count({ where: { clave } })).toBe(0);
  });
});
