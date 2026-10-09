import { describe, expect, it } from "vitest";
import { notFound, redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";

import {
  FIXED_NOW,
  GENERATED_COUNT,
  characterizeHandler,
  dbModuleMock,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectRowLockedBefore,
  generateResult,
  generateRow,
  isPrismaRead,
  isRowLock,
  normalizeHtml,
  normalizeIntlStrings,
  parsePrismaSchema,
  projectRows,
  recordEffect,
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

  it("unifica los espacios que Intl emite segun la version de ICU", () => {
    expect(
      normalizeHtml("<td>30 jun. 2026, 7:00\u202Fp.\u00A0m.</td><td>1\u2009000</td>"),
    ).toBe("<td>30 jun. 2026, 7:00 p. m.</td>\n<td>1 000</td>");
  });
});

describe("normalizeIntlStrings", () => {
  it("unifica los espacios en textos anidados y conserva fechas y Decimal", () => {
    const date = new Date(Date.UTC(2026, 6, 1));
    const amount = new Prisma.Decimal("10.50");

    const normalized = normalizeIntlStrings({
      metadata: "15/7/2026, 3:00:00\u202Fp.\u00A0m.",
      rows: [["a\u2009b", 3, null], [date, amount]],
    }) as { rows: unknown[][] };

    expect(normalized).toEqual({
      metadata: "15/7/2026, 3:00:00 p. m.",
      rows: [["a b", 3, null], [date, amount]],
    });
    expect(normalized.rows[1][0]).toBe(date);
    expect(normalized.rows[1][1]).toBe(amount);
  });
});

describe("characterizeHandler", () => {
  it("fija el reloj y la zona horaria, y registra lecturas y efectos en orden", async () => {
    const prisma = dbModuleMock().prisma as {
      cliente: { findMany: (args: unknown) => Promise<unknown[]> };
    };

    const { calls, result } = await characterizeHandler(async () => {
      const rows = await prisma.cliente.findMany({ take: 1 });

      recordEffect("archivo", { filas: rows.length });

      return {
        now: new Date().toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    });

    expect(result).toEqual({ now: FIXED_NOW.toISOString(), timeZone: "UTC" });
    expect(calls).toEqual([
      { prisma: "cliente.findMany", args: { take: 1 } },
      { effect: "archivo", args: { filas: 1 } },
    ]);
  });

  it("cada ejecucion empieza sin llamadas y con sus propios datos", async () => {
    const prisma = dbModuleMock().prisma as {
      cliente: { count: () => Promise<number> };
    };

    const first = await characterizeHandler(() => prisma.cliente.count(), {
      "cliente.count": 7,
    });
    const second = await characterizeHandler(() => prisma.cliente.count());

    expect(first.result).toBe(7);
    expect(second.result).toBe(GENERATED_COUNT);
    expect(second.calls).toEqual([{ prisma: "cliente.count", args: undefined }]);
  });
});

describe("dbModuleMock con transacciones", () => {
  type Client = {
    $transaction: <T>(callback: (tx: Client) => Promise<T>) => Promise<T>;
    cliente: {
      count: () => Promise<number>;
      create: (args: { data: object }) => Promise<unknown>;
    };
  };

  it("el cliente de solo lectura no admite transacciones ni escrituras", () => {
    const prisma = dbModuleMock().prisma as Client;

    expect(() => prisma.$transaction).toThrow("no esta soportado");
    expect(() => prisma.cliente.create).toThrow("solo leen");
  });

  it("registra la transaccion y las escrituras de su cliente, sin escribir fuera", async () => {
    const prisma = dbModuleMock({ transactions: true }).prisma as Client;

    expect(() => prisma.cliente.create).toThrow("solo leen");

    const { calls, result } = await characterizeHandler(() =>
      prisma.$transaction(async (tx) => {
        const total = await tx.cliente.count();
        const created = await tx.cliente.create({ data: { nombre: "A" } });

        return { total, created };
      }),
    );

    expect(result).toEqual({ total: GENERATED_COUNT, created: { nombre: "A" } });
    expect(calls).toEqual([
      { effect: "prisma.$transaction", args: null },
      { prisma: "cliente.count", args: undefined },
      { prisma: "cliente.create", args: { data: { nombre: "A" } } },
    ]);
  });

  it("un caso puede hacer fallar una escritura", async () => {
    const prisma = dbModuleMock({ transactions: true }).prisma as Client;

    await expect(
      characterizeHandler(
        () =>
          prisma.$transaction((tx) => tx.cliente.create({ data: { nombre: "A" } })),
        {
          "cliente.create": () => {
            throw new Error("fallo de escritura");
          },
        },
      ),
    ).rejects.toThrow("fallo de escritura");
  });

  it("registra update, updateMany y createMany con un resultado por defecto", async () => {
    type WriteClient = {
      cliente: {
        update: (args: object) => Promise<unknown>;
        updateMany: (args: object) => Promise<unknown>;
        createMany: (args: object) => Promise<unknown>;
      };
    };
    const prisma = dbModuleMock({ transactions: true }).prisma as {
      $transaction: <T>(callback: (tx: WriteClient) => Promise<T>) => Promise<T>;
    };

    const { calls, result } = await characterizeHandler(() =>
      prisma.$transaction(async (tx) => ({
        updated: await tx.cliente.update({
          where: { id_cliente: "CLI00000001" },
          data: { estado: false },
        }),
        updatedMany: await tx.cliente.updateMany({ data: { estado: true } }),
        created: await tx.cliente.createMany({
          data: [{ nombre: "A" }, { nombre: "B" }],
        }),
      })),
    );

    expect(result).toEqual({
      updated: { estado: false },
      updatedMany: { count: 1 },
      created: { count: 2 },
    });
    expect(calls).toEqual([
      { effect: "prisma.$transaction", args: null },
      {
        prisma: "cliente.update",
        args: { where: { id_cliente: "CLI00000001" }, data: { estado: false } },
      },
      { prisma: "cliente.updateMany", args: { data: { estado: true } } },
      {
        prisma: "cliente.createMany",
        args: { data: [{ nombre: "A" }, { nombre: "B" }] },
      },
    ]);
  });

  it("con recordTransactionEnd registra el commit, o el rollback con su motivo", async () => {
    const prisma = dbModuleMock({ transactions: true, recordTransactionEnd: true })
      .prisma as Client;

    const committed = await characterizeHandler(() =>
      prisma.$transaction((tx) => tx.cliente.count()),
    );

    expect(committed.calls).toEqual([
      { effect: "prisma.$transaction", args: null },
      { prisma: "cliente.count", args: undefined },
      { effect: "prisma.$transaction:commit", args: null },
    ]);

    const rolledBack = await characterizeHandler(() =>
      prisma
        .$transaction(async (tx) => {
          await tx.cliente.create({ data: { nombre: "A" } });
          throw new Error("Stock insuficiente.");
        })
        .catch((error: Error) => error.message),
    );

    expect(rolledBack.result).toBe("Stock insuficiente.");
    expect(rolledBack.calls).toEqual([
      { effect: "prisma.$transaction", args: null },
      { prisma: "cliente.create", args: { data: { nombre: "A" } } },
      { effect: "prisma.$transaction:rollback", args: "Stock insuficiente." },
    ]);
  });

  it("sin recordTransactionEnd no registra el final, como en la exportacion", async () => {
    const prisma = dbModuleMock({ transactions: true }).prisma as Client;

    const { calls } = await characterizeHandler(() =>
      prisma.$transaction((tx) => tx.cliente.count()),
    );

    expect(calls).toEqual([
      { effect: "prisma.$transaction", args: null },
      { prisma: "cliente.count", args: undefined },
    ]);
  });
});

describe("cliente global dentro de una transaccion", () => {
  type Client = {
    $transaction: <T>(callback: (tx: Client) => Promise<T>) => Promise<T>;
    cliente: { count: () => Promise<number> };
  };

  async function attempt(operation: () => Promise<unknown>) {
    try {
      await operation();

      return "lo permitio";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  for (const recordTransactionEnd of [true, false]) {
    it(`rechaza leer con el cliente global mientras la transaccion sigue abierta (recordTransactionEnd: ${recordTransactionEnd})`, async () => {
      const prisma = dbModuleMock({ transactions: true, recordTransactionEnd })
        .prisma as Client;

      const { calls, result } = await characterizeHandler(() =>
        prisma.$transaction(async (tx) => {
          await tx.cliente.count();

          return attempt(() => prisma.cliente.count());
        }),
      );

      expect(result).toBe(
        "prisma.cliente.count usa el cliente global dentro de una transaccion: debe usar el cliente de la transaccion.",
      );
      expect(calls.filter((call) => "prisma" in call)).toEqual([
        { prisma: "cliente.count", args: undefined },
      ]);
    });
  }

  it("rechaza abrir otra transaccion con el cliente global", async () => {
    const prisma = dbModuleMock({ transactions: true, recordTransactionEnd: true })
      .prisma as Client;

    const { result } = await characterizeHandler(() =>
      prisma.$transaction(() => attempt(() => prisma.$transaction(async () => 1))),
    );

    expect(result).toContain("prisma.$transaction usa el cliente global dentro de una transaccion");
  });

  it("al terminar la transaccion, con commit o con error, el cliente global vuelve a leer", async () => {
    const prisma = dbModuleMock({ transactions: true, recordTransactionEnd: true })
      .prisma as Client;

    const { result } = await characterizeHandler(async () => {
      await prisma.$transaction((tx) => tx.cliente.count());
      await prisma
        .$transaction(async () => {
          throw new Error("Stock insuficiente.");
        })
        .catch(() => undefined);

      return prisma.cliente.count();
    });

    expect(result).toBe(GENERATED_COUNT);
  });

  it("cada caso empieza sin transacciones abiertas aunque el anterior dejara una pendiente", async () => {
    const prisma = dbModuleMock({ transactions: true }).prisma as Client;

    await characterizeHandler(async () => {
      void prisma.$transaction(() => new Promise<never>(() => {}));
    });

    const { result } = await characterizeHandler(() => prisma.cliente.count());

    expect(result).toBe(GENERATED_COUNT);
  });
});

describe("SQL crudo y bloqueos de fila", () => {
  type RawClient = {
    $queryRaw: (query: unknown) => Promise<unknown>;
  };
  type Client = RawClient & {
    $transaction: <T>(callback: (tx: RawClient) => Promise<T>) => Promise<T>;
  };

  const ID = "CLI00000001";
  const lockSql = (table: string, mode = "FOR NO KEY UPDATE") => ({
    prisma: "$queryRaw",
    args: {
      sql: `SELECT id_${table} FROM aceros.${table} WHERE id_${table} = $1 ${mode}`,
      values: [ID],
    },
  });
  const read = { prisma: "cliente.findUnique", args: { where: { id_cliente: ID } } };
  const start = { effect: "prisma.$transaction", args: null };
  const commit = { effect: "prisma.$transaction:commit", args: null };
  const protectedRead = { table: "cliente", id: ID, reads: isPrismaRead };

  it("registra el SQL de la transaccion normalizado, con sus valores, y devuelve [] o lo que fije el caso", async () => {
    const prisma = dbModuleMock({ transactions: true }).prisma as Client;
    const lock = () =>
      prisma.$transaction((tx) =>
        tx.$queryRaw(Prisma.sql`
          SELECT id_cliente
          FROM aceros.cliente
          WHERE id_cliente = ${ID}
          FOR NO KEY UPDATE
        `),
      );

    const { calls, result } = await characterizeHandler(lock);

    expect(result).toEqual([]);
    expect(calls).toEqual([start, lockSql("cliente")]);

    const fixed = await characterizeHandler(lock, {
      $queryRaw: (args) => [{ fila: args?.values }],
    });

    expect(fixed.result).toEqual([{ fila: [ID] }]);
  });

  it("rechaza el SQL crudo fuera de una transaccion y el que no viene de Prisma.sql", async () => {
    const readOnly = dbModuleMock().prisma as Client;
    const transactional = dbModuleMock({ transactions: true }).prisma as Client;

    expect(() => readOnly.$queryRaw).toThrow("solo se admite dentro de una transaccion");
    expect(() => transactional.$queryRaw).toThrow("solo se admite dentro de una transaccion");
    await expect(
      transactional.$transaction((tx) => tx.$queryRaw("SELECT 1")),
    ).rejects.toThrow("solo admite prisma.$queryRaw con Prisma.sql");
  });

  it("isPrismaRead distingue las lecturas de las escrituras y del SQL crudo", () => {
    expect(isPrismaRead(read)).toBe(true);
    expect(isPrismaRead({ prisma: "cliente.update", args: {} })).toBe(false);
    expect(isPrismaRead(lockSql("cliente"))).toBe(false);
  });

  it("isRowLock exige la tabla, el id y FOR NO KEY UPDATE", () => {
    expect(isRowLock(lockSql("cliente"), "cliente", ID)).toBe(true);
    expect(isRowLock(lockSql("pedido"), "cliente", ID)).toBe(false);
    expect(isRowLock(lockSql("cliente"), "cliente", "CLI00000002")).toBe(false);
    expect(isRowLock(lockSql("cliente", "FOR UPDATE"), "cliente", ID)).toBe(false);
    expect(isRowLock(read, "cliente", ID)).toBe(false);
  });

  it("expectRowLockedBefore acepta el bloqueo antes de leer, con la transaccion abierta", () => {
    expect(() =>
      expectRowLockedBefore([start, lockSql("cliente"), read, read, commit], protectedRead),
    ).not.toThrow();
  });

  it("expectRowLockedBefore rechaza leer sin bloqueo, bloquear despues, cerrar antes o no leer", () => {
    expect(() => expectRowLockedBefore([read, start, commit], protectedRead)).toThrow(
      "no se bloquea la fila",
    );
    expect(() =>
      expectRowLockedBefore([start, read, lockSql("cliente"), commit], protectedRead),
    ).toThrow("se bloquea despues de leerla");
    expect(() =>
      expectRowLockedBefore(
        [start, lockSql("cliente"), read, commit, start, read, commit],
        protectedRead,
      ),
    ).toThrow("la transaccion termina antes");
    expect(() =>
      expectRowLockedBefore([start, lockSql("cliente", "FOR UPDATE"), read], protectedRead),
    ).toThrow("no se bloquea la fila");
    expect(() => expectRowLockedBefore([start, lockSql("cliente")], protectedRead)).toThrow(
      "ninguna lectura protegida",
    );
  });
});

describe("decimalSnapshotSerializer", () => {
  it("imprime los Decimal con su valor y deja pasar los demas valores", () => {
    expect(decimalSnapshotSerializer.test(new Prisma.Decimal("11.50"))).toBe(true);
    expect(decimalSnapshotSerializer.test(11.5)).toBe(false);
    expect(decimalSnapshotSerializer.test("11.50")).toBe(false);
    expect(decimalSnapshotSerializer.serialize(new Prisma.Decimal("11.50"))).toBe(
      "Decimal(11.5)",
    );
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
