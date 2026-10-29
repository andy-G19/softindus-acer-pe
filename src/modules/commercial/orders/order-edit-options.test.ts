import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { buildOrderEditOptions } from "@/modules/commercial/orders/order-edit-options";

const ACTIVE_CLIENT = { id_cliente: "CLI00000001", nombre_razon_social: "Ferretería El Perno", tipo_cliente: "ferreteria" };
const INACTIVE_CLIENT = { id_cliente: "CLI00000099", nombre_razon_social: "Cliente dado de baja", tipo_cliente: "otro" };
const ACTIVE_PRODUCT = {
  id_producto: "PRO00000001",
  nombre_producto: "Puerta metálica",
  categoria: "estructuras",
  unidad_medida: "unidad",
  precio_referencial: new Prisma.Decimal("450"),
};
const INACTIVE_PRODUCT = {
  id_producto: "PRO00000099",
  nombre_producto: "Producto dado de baja",
  categoria: "herramientas",
  unidad_medida: "unidad",
  precio_referencial: null,
};

describe("buildOrderEditOptions", () => {
  it("con cliente y productos activos ofrece solo los activos, sin marca", () => {
    const options = buildOrderEditOptions(
      { cliente: ACTIVE_CLIENT, detalle_pedido: [{ producto: ACTIVE_PRODUCT }] },
      [ACTIVE_CLIENT],
      [ACTIVE_PRODUCT],
    );

    expect(options).toEqual({
      clients: [ACTIVE_CLIENT],
      products: [{ ...ACTIVE_PRODUCT, precio_referencial: "450" }],
    });
  });

  it("suma al final el cliente y los productos actuales inactivos, marcados", () => {
    const options = buildOrderEditOptions(
      { cliente: INACTIVE_CLIENT, detalle_pedido: [{ producto: ACTIVE_PRODUCT }, { producto: INACTIVE_PRODUCT }] },
      [ACTIVE_CLIENT],
      [ACTIVE_PRODUCT],
    );

    expect(options).toEqual({
      clients: [ACTIVE_CLIENT, { ...INACTIVE_CLIENT, inactivo: true }],
      products: [
        { ...ACTIVE_PRODUCT, precio_referencial: "450" },
        { ...INACTIVE_PRODUCT, inactivo: true },
      ],
    });
  });

  it("no ofrece otros inactivos que el pedido no tiene", () => {
    const options = buildOrderEditOptions(
      { cliente: ACTIVE_CLIENT, detalle_pedido: [{ producto: ACTIVE_PRODUCT }] },
      [ACTIVE_CLIENT],
      [ACTIVE_PRODUCT],
    );

    expect(options.clients.map((client) => client.id_cliente)).toEqual(["CLI00000001"]);
    expect(options.products.map((product) => product.id_producto)).toEqual(["PRO00000001"]);
  });
});
