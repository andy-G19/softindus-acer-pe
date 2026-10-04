import { describe, expect, it, vi } from "vitest";

import {
  characterizePage,
  expectAuthorizesBeforePrisma,
  isPrismaCall,
  preloadPages,
  projectRows,
  runWithRejectedAuth,
  type DataOverrides,
  type PrismaCall,
} from "@/testing/page-characterization";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock(),
);
vi.mock("@/lib/authz", async () =>
  (await import("@/testing/page-characterization")).authzModuleMock(),
);
vi.mock("next/navigation", async (importOriginal) =>
  (await import("@/testing/page-characterization")).navigationModuleMock(
    await importOriginal(),
  ),
);

// Caracterizacion de las paginas de Clientes (entrega 4.1). Se escribio antes
// de mover sus consultas a modules/commercial/clients/queries.ts: los mismos
// snapshots deben seguir pasando despues del cambio.

const LIST_ROUTE = "/dashboard/commercial/clients";
const loadList = () => import("./page");
const loadEdit = () => import("./[id]/edit/page");

preloadPages(loadList, loadEdit);

const CLIENT_ROWS = [
  {
    id_cliente: "CLI00000003",
    tipo_cliente: "empresa",
    nombre_razon_social: "Metalmecanica Andina SAC",
    tipo_documento: "RUC",
    numero_documento: "20123456789",
    telefono: "987654321",
    correo: "compras@andina.pe",
    direccion: "Av. Industrial 123",
    lugar_origen: "Arequipa",
    observaciones: "Cliente frecuente",
    fecha_registro: new Date("2026-06-02T15:00:00.000Z"),
    estado: true,
  },
  {
    id_cliente: "CLI00000002",
    tipo_cliente: "persona",
    nombre_razon_social: "Juan Quispe",
    tipo_documento: null,
    numero_documento: null,
    telefono: null,
    correo: null,
    direccion: null,
    lugar_origen: null,
    observaciones: null,
    fecha_registro: new Date("2026-05-20T15:00:00.000Z"),
    estado: false,
  },
];

const CLIENT_OPTIONS = [
  {
    id_cliente: "CLI00000001",
    nombre_razon_social: "Aceros del Sur EIRL",
    tipo_cliente: "empresa",
    numero_documento: "20987654321",
    telefono: null,
    lugar_origen: "Tacna",
  },
  {
    id_cliente: "CLI00000002",
    nombre_razon_social: "Juan Quispe",
    tipo_cliente: "persona",
    numero_documento: null,
    telefono: null,
    lugar_origen: null,
  },
  {
    id_cliente: "CLI00000003",
    nombre_razon_social: "Metalmecanica Andina SAC",
    tipo_cliente: "empresa",
    numero_documento: "20123456789",
    telefono: "987654321",
    lugar_origen: "Arequipa",
  },
];

// La pagina del listado consulta cliente.findMany dos veces: las opciones del
// buscador (sin paginacion) y la pagina de filas (con take). Las filas se
// recortan segun el select de la consulta, como haria Prisma.
function listData(
  rows: Array<Record<string, unknown>>,
  totalItems: number,
): DataOverrides {
  return {
    "cliente.findMany": (args) =>
      args && "take" in args ? projectRows(rows, args) : CLIENT_OPTIONS,
    "cliente.count": totalItems,
  };
}

const WITH_DATA = listData(CLIENT_ROWS, 45);

function prismaCalls(calls: Awaited<ReturnType<typeof characterizePage>>["calls"]) {
  return calls.filter(isPrismaCall);
}

function rowsQuery(calls: PrismaCall[]) {
  const call = calls.find(
    (item) =>
      item.prisma === "cliente.findMany" &&
      typeof item.args === "object" &&
      item.args !== null &&
      "take" in item.args,
  );

  if (!call) {
    throw new Error("No se consulto la pagina de filas.");
  }

  return call.args as { where?: unknown; skip: number; take: number };
}

describe("listado de clientes", () => {
  it("consulta Prisma con los mismos argumentos", async () => {
    const result = await characterizePage(
      loadList,
      {
        name: "filtros completos",
        searchParams: {
          client: "CLI00000003",
          q: "andina",
          type: "empresa",
          status: "activo",
          origin: "Arequipa",
          page: "2",
        },
        data: WITH_DATA,
      },
      LIST_ROUTE,
    );

    expectAuthorizesBeforePrisma(result.calls);
    expect(result.calls).toMatchSnapshot();
  });

  const FILTER_CASES: Array<[string, Record<string, string | string[]>]> = [
    ["sin filtros", {}],
    ["cliente", { client: "CLI00000001" }],
    ["busqueda con espacios", { q: "  andina  " }],
    ["busqueda repetida toma el primer valor", { q: ["andina", "sur"] }],
    ["tipo", { type: "empresa" }],
    ["estado activo", { status: "activo" }],
    ["estado inactivo", { status: "inactivo" }],
    ["estado desconocido no filtra", { status: "todos" }],
    ["origen", { origin: " Tacna " }],
    [
      "todos los filtros",
      {
        client: "CLI00000003",
        q: "andina",
        type: "empresa",
        status: "inactivo",
        origin: "Arequipa",
      },
    ],
    ["pagina y tamano", { page: "3", pageSize: "5" }],
    ["pagina y tamano fuera de rango", { page: "0", pageSize: "500" }],
  ];

  it.each(FILTER_CASES)("filtro: %s", async (_name, searchParams) => {
    const result = await characterizePage(
      loadList,
      { name: "filtro", searchParams, data: WITH_DATA },
      LIST_ROUTE,
    );
    const calls = prismaCalls(result.calls);
    const rows = rowsQuery(calls);
    const count = calls.find((call) => call.prisma === "cliente.count");

    // El total y las filas usan siempre el mismo filtro.
    expect(count?.args).toEqual({ where: rows.where });
    expect({ where: rows.where, skip: rows.skip, take: rows.take }).toMatchSnapshot();
  });

  it("muestra filas, opciones, filtros y paginacion", async () => {
    const result = await characterizePage(
      loadList,
      {
        name: "con datos",
        searchParams: { q: "andina", status: "activo", page: "2" },
        data: WITH_DATA,
      },
      LIST_ROUTE,
    );

    expect(result.outcome).toBe("render");
    expect(result.html).toMatchSnapshot();
  });

  it("muestra el estado vacio", async () => {
    const result = await characterizePage(
      loadList,
      { name: "vacio", data: listData([], 0) },
      LIST_ROUTE,
    );

    expect(result.html).toMatchSnapshot();
  });

  it("un acceso rechazado no consulta Prisma", async () => {
    const calls = await runWithRejectedAuth(loadList, { name: "rechazo" }, LIST_ROUTE);

    expect(calls).toEqual([{ authz: "requireRole", roles: ["ADMIN", "SELLER"] }]);
  });
});

describe("edicion de cliente", () => {
  const EDIT_ROUTE = `${LIST_ROUTE}/CLI00000003/edit`;

  it("consulta el cliente y muestra el formulario con el regreso al listado", async () => {
    const result = await characterizePage(
      loadEdit,
      {
        name: "editar",
        params: { id: "CLI00000003" },
        searchParams: { returnTo: `${LIST_ROUTE}?q=andina&page=2` },
        data: { "cliente.findUnique": CLIENT_ROWS[0] },
      },
      EDIT_ROUTE,
    );

    expectAuthorizesBeforePrisma(result.calls);
    expect(result.calls).toMatchSnapshot("llamadas");
    expect(result.html).toMatchSnapshot("html");
  });

  it("muestra vacios los campos opcionales ausentes e ignora un regreso externo", async () => {
    const result = await characterizePage(
      loadEdit,
      {
        name: "editar con nulos",
        params: { id: "CLI00000002" },
        searchParams: { returnTo: "https://example.com/phishing" },
        data: { "cliente.findUnique": CLIENT_ROWS[1] },
      },
      EDIT_ROUTE,
    );

    expect(result.html).toMatchSnapshot();
  });

  it("responde notFound si el cliente no existe", async () => {
    const result = await characterizePage(
      loadEdit,
      {
        name: "inexistente",
        params: { id: "CLI99999999" },
        data: { "cliente.findUnique": null },
      },
      EDIT_ROUTE,
    );

    expect(result.outcome).toBe("notFound");
  });

  it("un acceso rechazado no consulta Prisma", async () => {
    const calls = await runWithRejectedAuth(
      loadEdit,
      { name: "rechazo", params: { id: "CLI00000003" } },
      EDIT_ROUTE,
    );

    expect(calls).toEqual([{ authz: "requireRole", roles: ["ADMIN", "SELLER"] }]);
  });
});
