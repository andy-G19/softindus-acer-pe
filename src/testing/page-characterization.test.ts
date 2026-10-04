import { describe, expect, it } from "vitest";
import { notFound, redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";

import {
  GENERATED_COUNT,
  describeNavigationError,
  generateResult,
  generateRow,
  normalizeHtml,
  parsePrismaSchema,
  projectRows,
} from "./page-characterization";

// Pruebas del arnes de caracterizacion de paginas: si el arnes generara datos
// o normalizara el HTML de forma incorrecta, los snapshots de las paginas
// perderian su valor como evidencia.

const SCHEMA = `
/// comentario de documentacion
model cliente {
  id_cliente String  @id @db.Char(11)
  nombre     String  @db.VarChar(150)
  telefono   String? @db.VarChar(20)
  estado     Boolean @default(true)
  pedido     pedido[]

  @@index([estado], map: "idx_cliente_estado")
  @@schema("aceros")
}

model pedido {
  id_pedido      String   @id @db.Char(11)
  id_cliente     String   @db.Char(11)
  fecha_pedido   DateTime @db.Date
  monto_estimado Decimal? @db.Decimal(12, 2)
  cantidad       Int
  cliente        cliente  @relation(fields: [id_cliente], references: [id_cliente])
}
`;

const models = parsePrismaSchema(SCHEMA);

describe("parsePrismaSchema", () => {
  it("lee campos, listas, opcionales y relaciones, sin atributos de bloque", () => {
    expect(models.get("cliente")).toEqual([
      { name: "id_cliente", type: "String", isList: false, isOptional: false, isRelation: false },
      { name: "nombre", type: "String", isList: false, isOptional: false, isRelation: false },
      { name: "telefono", type: "String", isList: false, isOptional: true, isRelation: false },
      { name: "estado", type: "Boolean", isList: false, isOptional: false, isRelation: false },
      { name: "pedido", type: "pedido", isList: true, isOptional: false, isRelation: true },
    ]);
    expect(models.get("pedido")?.find((field) => field.name === "cliente")).toEqual({
      name: "cliente",
      type: "cliente",
      isList: false,
      isOptional: false,
      isRelation: true,
    });
  });

  it("acepta saltos de linea CRLF", () => {
    const crlf = parsePrismaSchema(SCHEMA.replace(/\n/g, "\r\n"));

    expect(crlf).toEqual(models);
  });
});

describe("generateRow", () => {
  it("sin select devuelve todos los escalares y ninguna relacion", () => {
    expect(generateRow(models, "cliente", undefined, 1)).toEqual({
      id_cliente: "id_cliente-1",
      nombre: "nombre-1",
      telefono: "telefono-1",
      estado: true,
    });
  });

  it("en las filas pares los opcionales valen null", () => {
    expect(generateRow(models, "cliente", undefined, 2)).toEqual({
      id_cliente: "id_cliente-2",
      nombre: "nombre-2",
      telefono: null,
      estado: false,
    });
  });

  it("respeta select, relaciones anidadas, take y _count", () => {
    const row = generateRow(
      models,
      "cliente",
      {
        select: {
          nombre: true,
          telefono: false,
          pedido: { select: { id_pedido: true }, take: 1 },
          _count: { select: { pedido: true } },
        },
      },
      1,
    );

    expect(row).toEqual({
      nombre: "nombre-1",
      pedido: [{ id_pedido: "id_pedido-1" }],
      _count: { pedido: 2 },
    });
  });

  it("include agrega relaciones a los escalares y omit los quita", () => {
    const row = generateRow(
      models,
      "pedido",
      { include: { cliente: true }, omit: { cantidad: true } },
      1,
    );

    expect(row).toEqual({
      id_pedido: "id_pedido-1",
      id_cliente: "id_cliente-1",
      fecha_pedido: new Date(Date.UTC(2026, 6, 1)),
      monto_estimado: new Prisma.Decimal("11.50"),
      cliente: {
        id_cliente: "id_cliente-1",
        nombre: "nombre-1",
        telefono: "telefono-1",
        estado: true,
      },
    });
    expect(row.monto_estimado).toBeInstanceOf(Prisma.Decimal);
  });

  it("rechaza un campo que no existe en el esquema", () => {
    expect(() =>
      generateRow(models, "cliente", { select: { inexistente: true } }, 1),
    ).toThrow("cliente.inexistente");
  });
});

describe("generateResult", () => {
  it("findMany devuelve dos filas, o menos si take lo limita", () => {
    expect(generateResult(models, "cliente", "findMany", undefined)).toHaveLength(2);
    expect(generateResult(models, "cliente", "findMany", { take: 1 })).toHaveLength(1);
    expect(generateResult(models, "cliente", "findMany", { take: 20 })).toHaveLength(2);
  });

  it("count devuelve un total fijo, o un objeto si lleva select", () => {
    expect(generateResult(models, "cliente", "count", { where: {} })).toBe(GENERATED_COUNT);
    expect(
      generateResult(models, "cliente", "count", { select: { _all: true } }),
    ).toEqual({ _all: GENERATED_COUNT });
  });

  it("aggregate devuelve solo las operaciones pedidas", () => {
    expect(
      generateResult(models, "pedido", "aggregate", {
        _sum: { monto_estimado: true, cantidad: true },
        _avg: { monto_estimado: true },
        _count: true,
      }),
    ).toEqual({
      _sum: { monto_estimado: new Prisma.Decimal("1234.50"), cantidad: 13 },
      _avg: { monto_estimado: new Prisma.Decimal("617.25") },
      _count: GENERATED_COUNT,
    });
  });

  it("groupBy devuelve los campos agrupados con sus agregados", () => {
    expect(
      generateResult(models, "pedido", "groupBy", {
        by: ["id_cliente"],
        _sum: { cantidad: true },
      }),
    ).toEqual([
      { id_cliente: "id_cliente-1", _sum: { cantidad: 13 } },
      { id_cliente: "id_cliente-2", _sum: { cantidad: 13 } },
    ]);
  });

  it("rechaza los metodos que escriben", () => {
    expect(() => generateResult(models, "cliente", "update", {})).toThrow(
      "no esta soportado",
    );
  });
});

describe("projectRows", () => {
  it("recorta las filas segun el select y sin select las deja completas", () => {
    const rows = [{ id: "1", nombre: "A", telefono: null }];

    expect(projectRows(rows, { select: { id: true, telefono: true, nombre: false } })).toEqual([
      { id: "1", telefono: null },
    ]);
    expect(projectRows(rows, { where: {} })).toBe(rows);
  });
});

describe("normalizeHtml", () => {
  it("quita estilos e iconos y deja una etiqueta por linea", () => {
    expect(
      normalizeHtml(
        '<a class="btn" data-slot="button" data-size="sm" data-variant="ghost" href="/x">Editar<svg class="lucide"><path d="M1"></path></svg></a>',
      ),
    ).toBe('<a data-variant="ghost" href="/x">Editar<svg/>\n</a>');
  });
});

describe("describeNavigationError", () => {
  function capture(callback: () => void) {
    try {
      callback();
    } catch (error) {
      return error;
    }

    throw new Error("No lanzo.");
  }

  it("reconoce notFound y redirect de Next, e ignora otros errores", () => {
    expect(describeNavigationError(capture(() => notFound()))).toBe("notFound");
    expect(
      describeNavigationError(capture(() => redirect("/dashboard/access-denied"))),
    ).toBe("redirect:/dashboard/access-denied");
    expect(describeNavigationError(new Error("fallo"))).toBeNull();
  });
});

describe("esquema real", () => {
  it("se analiza y contiene las relaciones de cliente", async () => {
    const { readFileSync } = await import("node:fs");
    const schema = parsePrismaSchema(readFileSync("prisma/schema.prisma", "utf8"));

    expect(schema.size).toBe(62);
    expect(schema.get("cliente")?.find((field) => field.name === "pedido")).toMatchObject({
      isList: true,
      isRelation: true,
    });
  });
});
