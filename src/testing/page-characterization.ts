// Arnes de caracterizacion de paginas (entrega 4).
//
// Ejecuta una pagina real del App Router con Prisma, la sesion y la navegacion
// simulados, y devuelve lo necesario para fijar su comportamiento en un
// snapshot antes de mover sus consultas:
// - las llamadas a Prisma (modelo, metodo y argumentos) y a la autorizacion,
//   en el orden en que ocurren;
// - el resultado: render, notFound o redirect;
// - el HTML renderizado, normalizado para que no dependa de los estilos.
//
// Los datos que devuelve Prisma se generan a partir de prisma/schema.prisma
// segun el select, include u omit de cada llamada, de forma determinista. Cada
// caso puede sustituirlos por llamada (`data`).
//
// Cada archivo de prueba debe declarar estos mocks, porque vi.mock se eleva
// al inicio de su propio archivo:
//
//   vi.mock("server-only", () => ({}));
//   vi.mock("@/lib/db", async () =>
//     (await import("@/testing/page-characterization")).dbModuleMock());
//   vi.mock("@/lib/authz", async () =>
//     (await import("@/testing/page-characterization")).authzModuleMock());
//   vi.mock("next/navigation", async (importOriginal) =>
//     (await import("@/testing/page-characterization")).navigationModuleMock(
//       await importOriginal(),
//     ));

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Esquema de Prisma
// ---------------------------------------------------------------------------

export type SchemaField = {
  name: string;
  type: string;
  isList: boolean;
  isOptional: boolean;
  isRelation: boolean;
};

export type SchemaModels = Map<string, SchemaField[]>;

const MODEL_BLOCK = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
const FIELD_LINE = /^\s+(\w+)\s+(\w+)(\[\])?(\?)?/;

export function parsePrismaSchema(source: string): SchemaModels {
  const blocks = [...source.matchAll(MODEL_BLOCK)];
  const modelNames = new Set(blocks.map((block) => block[1]));
  const models: SchemaModels = new Map();

  for (const [, modelName, body] of blocks) {
    const fields: SchemaField[] = [];

    for (const line of body.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("@@") || trimmed.startsWith("//")) {
        continue;
      }

      const match = FIELD_LINE.exec(line);

      if (!match) {
        continue;
      }

      const [, name, type, list, optional] = match;

      fields.push({
        name,
        type,
        isList: Boolean(list),
        isOptional: Boolean(optional),
        isRelation: modelNames.has(type),
      });
    }

    models.set(modelName, fields);
  }

  return models;
}

let schemaCache: SchemaModels | null = null;

function getSchema() {
  if (!schemaCache) {
    const schemaPath = fileURLToPath(
      new URL("../../prisma/schema.prisma", import.meta.url),
    );

    schemaCache = parsePrismaSchema(readFileSync(schemaPath, "utf8"));
  }

  return schemaCache;
}

function getModelFields(models: SchemaModels, modelName: string) {
  const fields = models.get(modelName);

  if (!fields) {
    throw new Error(`El modelo ${modelName} no existe en schema.prisma.`);
  }

  return fields;
}

// ---------------------------------------------------------------------------
// Datos generados
// ---------------------------------------------------------------------------

// findMany devuelve como maximo LIST_SIZE filas, y count un total mayor para
// que los listados muestren su paginacion.
export const LIST_SIZE = 2;
export const GENERATED_COUNT = 42;

export type PrismaArgs = Record<string, unknown> | undefined;
type Row = Record<string, unknown>;

function asArgs(value: unknown): PrismaArgs {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

// Fila n (desde 1). En las filas pares los campos opcionales valen null, para
// recorrer tambien las ramas de valor ausente.
export function generateScalar(field: SchemaField, n: number): unknown {
  if (field.isOptional && n % 2 === 0) {
    return null;
  }

  switch (field.type) {
    case "String":
      return `${field.name}-${n}`;
    case "Int":
      return n;
    case "BigInt":
      return BigInt(n);
    case "Float":
      return n + 0.5;
    case "Decimal":
      return new Prisma.Decimal(`${n * 11}.50`);
    case "Boolean":
      return n % 2 === 1;
    case "DateTime":
      return new Date(Date.UTC(2026, 6, n));
    case "Json":
      return {};
    default:
      throw new Error(`Tipo ${field.type} sin generador en el arnes.`);
  }
}

function generateCount(
  models: SchemaModels,
  modelName: string,
  value: unknown,
) {
  const fields = getModelFields(models, modelName);
  const select = asArgs(asArgs(value)?.select);
  const relationNames = select
    ? Object.keys(select).filter((key) => select[key])
    : fields.filter((field) => field.isList).map((field) => field.name);

  return Object.fromEntries(relationNames.map((name) => [name, LIST_SIZE]));
}

function listLength(args: PrismaArgs) {
  const take = typeof args?.take === "number" ? Math.abs(args.take) : LIST_SIZE;

  return Math.min(take, LIST_SIZE);
}

function generateRelation(
  models: SchemaModels,
  field: SchemaField,
  args: PrismaArgs,
  n: number,
) {
  if (field.isList) {
    return Array.from({ length: listLength(args) }, (_, index) =>
      generateRow(models, field.type, args, index + 1),
    );
  }

  return generateRow(models, field.type, args, n);
}

export function generateRow(
  models: SchemaModels,
  modelName: string,
  args: PrismaArgs,
  n: number,
): Row {
  const fields = getModelFields(models, modelName);
  const findField = (name: string) => {
    const field = fields.find((item) => item.name === name);

    if (!field) {
      throw new Error(`El campo ${modelName}.${name} no existe.`);
    }

    return field;
  };
  const row: Row = {};
  const select = asArgs(args?.select);

  if (select) {
    for (const [key, value] of Object.entries(select)) {
      if (!value) {
        continue;
      }

      if (key === "_count") {
        row._count = generateCount(models, modelName, value);
        continue;
      }

      const field = findField(key);

      row[key] = field.isRelation
        ? generateRelation(models, field, asArgs(value), n)
        : generateScalar(field, n);
    }

    return row;
  }

  const omit = asArgs(args?.omit);

  for (const field of fields) {
    if (!field.isRelation && !omit?.[field.name]) {
      row[field.name] = generateScalar(field, n);
    }
  }

  const include = asArgs(args?.include);

  for (const [key, value] of Object.entries(include ?? {})) {
    if (!value) {
      continue;
    }

    if (key === "_count") {
      row._count = generateCount(models, modelName, value);
      continue;
    }

    row[key] = generateRelation(models, findField(key), asArgs(value), n);
  }

  return row;
}

function generateAggregateValue(field: SchemaField, operation: string) {
  if (field.type === "Decimal") {
    return new Prisma.Decimal(operation === "_avg" ? "617.25" : "1234.50");
  }

  if (field.type === "Int" || field.type === "BigInt" || field.type === "Float") {
    return operation === "_avg" ? 6.5 : 13;
  }

  return generateScalar({ ...field, isOptional: false }, 1);
}

const AGGREGATE_OPERATIONS = ["_sum", "_avg", "_min", "_max"] as const;

function generateAggregates(
  models: SchemaModels,
  modelName: string,
  args: PrismaArgs,
) {
  const fields = getModelFields(models, modelName);
  const result: Row = {};

  for (const operation of AGGREGATE_OPERATIONS) {
    const requested = asArgs(args?.[operation]);

    if (!requested) {
      continue;
    }

    result[operation] = Object.fromEntries(
      Object.keys(requested)
        .filter((name) => requested[name])
        .map((name) => {
          const field = fields.find((item) => item.name === name);

          if (!field) {
            throw new Error(`El campo ${modelName}.${name} no existe.`);
          }

          return [name, generateAggregateValue(field, operation)];
        }),
    );
  }

  if (args?._count) {
    const requested = asArgs(args._count);

    result._count = requested
      ? Object.fromEntries(
          Object.keys(requested)
            .filter((name) => requested[name])
            .map((name) => [name, GENERATED_COUNT]),
        )
      : GENERATED_COUNT;
  }

  return result;
}

export function generateResult(
  models: SchemaModels,
  modelName: string,
  method: string,
  args: PrismaArgs,
): unknown {
  switch (method) {
    case "findMany":
      return Array.from({ length: listLength(args) }, (_, index) =>
        generateRow(models, modelName, args, index + 1),
      );
    case "findFirst":
    case "findFirstOrThrow":
    case "findUnique":
    case "findUniqueOrThrow":
      return generateRow(models, modelName, args, 1);
    case "count": {
      const select = asArgs(args?.select);

      return select
        ? Object.fromEntries(
            Object.keys(select)
              .filter((name) => select[name])
              .map((name) => [name, GENERATED_COUNT]),
          )
        : GENERATED_COUNT;
    }
    case "aggregate":
      return generateAggregates(models, modelName, args);
    case "groupBy": {
      const fields = getModelFields(models, modelName);
      const by = Array.isArray(args?.by) ? (args.by as string[]) : [];

      return Array.from({ length: LIST_SIZE }, (_, index) => {
        const row: Row = generateAggregates(models, modelName, args);

        for (const name of by) {
          const field = fields.find((item) => item.name === name);

          if (!field) {
            throw new Error(`El campo ${modelName}.${name} no existe.`);
          }

          row[name] = generateScalar(field, index + 1);
        }

        return row;
      });
    }
    default:
      throw new Error(`prisma.${modelName}.${method} no esta soportado por el arnes.`);
  }
}

// Resultado generado para una llamada, para que un caso lo tome como base y
// cambie solo lo que necesita (por ejemplo, un pedido sin proformas).
export function generatedResult(modelName: string, method: string, args: PrismaArgs) {
  return generateResult(getSchema(), modelName, method, args);
}

export function generatedRow(modelName: string, method: string, args: PrismaArgs) {
  return generatedResult(modelName, method, args) as Row;
}

// ---------------------------------------------------------------------------
// Estado de la ejecucion y dobles
// ---------------------------------------------------------------------------

export type Role = "ADMIN" | "SELLER" | "WORKSHOP_MASTER";

export type PrismaCall = { prisma: string; args: unknown };
export type AuthzCall = { authz: string; roles: unknown };
// Efecto simulado por un archivo de prueba (correlativo, bitacora, archivo
// generado...), registrado en la misma secuencia que las llamadas a Prisma.
export type EffectCall = { effect: string; args: unknown };
export type RecordedCall = PrismaCall | AuthzCall | EffectCall;

// Recorta filas escritas a mano segun el select de la llamada, como haria
// Prisma. Sin select las devuelve completas.
export function projectRows(rows: Row[], args: PrismaArgs) {
  const select = asArgs(args?.select);

  if (!select) {
    return rows;
  }

  const keys = Object.keys(select).filter((key) => select[key]);

  return rows.map((row) =>
    Object.fromEntries(keys.filter((key) => key in row).map((key) => [key, row[key]])),
  );
}

// Sustituye el resultado de una llamada, por clave "modelo.metodo". Una
// funcion recibe los argumentos de la llamada.
export type DataOverride = ((args: PrismaArgs) => unknown) | object | number | null;
export type DataOverrides = Record<string, DataOverride>;

type HarnessState = {
  calls: RecordedCall[];
  data: DataOverrides;
  role: Role;
  rejectAuth: boolean;
  pathname: string;
  search: string;
  params: Record<string, string | string[]>;
};

const state: HarnessState = {
  calls: [],
  data: {},
  role: "ADMIN",
  rejectAuth: false,
  pathname: "/",
  search: "",
  params: {},
};

export class AuthRejected extends Error {
  constructor() {
    super("Acceso rechazado por el doble de autorizacion.");
  }
}

const PRISMA_METHODS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

// Escrituras que admite el cliente de una transaccion simulada. Devuelven el
// `data` recibido, salvo que el caso sustituya su resultado.
const WRITE_METHODS = new Set(["create"]);

function createModelDelegate(modelName: string, inTransaction: boolean) {
  return new Proxy(
    {},
    {
      get(_target, method) {
        if (typeof method === "symbol" || method === "then") {
          return undefined;
        }

        const isWrite = inTransaction && WRITE_METHODS.has(method);

        if (!PRISMA_METHODS.has(method) && !isWrite) {
          throw new Error(
            `prisma.${modelName}.${method} no esta soportado por el arnes: las paginas solo leen.`,
          );
        }

        return async (args?: PrismaArgs) => {
          const key = `${modelName}.${method}`;

          state.calls.push({ prisma: key, args });

          if (Object.prototype.hasOwnProperty.call(state.data, key)) {
            const override = state.data[key];

            return typeof override === "function" ? override(args) : override;
          }

          if (isWrite) {
            return args?.data ?? null;
          }

          return generateResult(getSchema(), modelName, method, args);
        };
      },
    },
  );
}

type PrismaDoubleOptions = {
  // El cliente admite $transaction (solo lo piden los route handlers).
  transactions: boolean;
  // Es el cliente que recibe el callback de $transaction: admite escrituras.
  inTransaction: boolean;
};

function createPrismaDouble(options: PrismaDoubleOptions): object {
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property === "symbol" || property === "then") {
          return undefined;
        }

        if (property === "$transaction" && options.transactions) {
          return async (callback: (tx: object) => Promise<unknown>) => {
            state.calls.push({ effect: "prisma.$transaction", args: null });

            return callback(transactionDouble);
          };
        }

        if (property.startsWith("$")) {
          throw new Error(`prisma.${property} no esta soportado por el arnes.`);
        }

        getModelFields(getSchema(), property);

        return createModelDelegate(property, options.inTransaction);
      },
    },
  );
}

export const prismaDouble = createPrismaDouble({
  transactions: false,
  inTransaction: false,
});

const transactionalPrismaDouble = createPrismaDouble({
  transactions: true,
  inTransaction: false,
});

const transactionDouble = createPrismaDouble({
  transactions: false,
  inTransaction: true,
});

// Las paginas usan el doble de solo lectura. Un route handler que escribe
// dentro de una transaccion pide `{ transactions: true }`: el cliente de la
// transaccion registra sus escrituras sin aplicarlas.
export function dbModuleMock(options: { transactions?: boolean } = {}) {
  return {
    prisma: options.transactions ? transactionalPrismaDouble : prismaDouble,
  };
}

export function recordEffect(effect: string, args: unknown) {
  state.calls.push({ effect, args });
}

function createSession() {
  return {
    user: {
      id: "USU00000001",
      name: "Usuario de prueba",
      email: "prueba@example.com",
      role: state.role,
      status: "activo",
    },
    expires: "2026-12-31T00:00:00.000Z",
  };
}

function createGuard(name: string, checksRole: boolean) {
  return async (roles?: Role[]) => {
    state.calls.push({ authz: name, roles });

    if (state.rejectAuth || (checksRole && !roles?.includes(state.role))) {
      throw new AuthRejected();
    }

    return createSession();
  };
}

export function authzModuleMock() {
  return {
    requireRole: createGuard("requireRole", true),
    requireAuth: createGuard("requireAuth", false),
    requireActiveUser: createGuard("requireActiveUser", false),
    getActiveUserSession: createGuard("getActiveUserSession", false),
    getAuthorizedSession: createGuard("getAuthorizedSession", true),
    assertRole: () => true,
  };
}

const routerStub = {
  back() {},
  forward() {},
  push() {},
  replace() {},
  refresh() {},
  prefetch() {},
};

export function navigationModuleMock(actual: unknown) {
  return {
    ...(actual as Record<string, unknown>),
    useRouter: () => routerStub,
    usePathname: () => state.pathname,
    useSearchParams: () => new URLSearchParams(state.search),
    useParams: () => state.params,
  };
}

// ---------------------------------------------------------------------------
// Ejecucion de una pagina
// ---------------------------------------------------------------------------

// Instante fijo para las paginas que usan la fecha actual: 15/07/2026 a las
// 10:00 de Lima.
export const FIXED_NOW = new Date("2026-07-15T15:00:00.000Z");

// Zona horaria fija, la de Vercel. Algunas paginas interpretan fechas en la
// zona del proceso (parseDateParam, setHours): sin fijarla, los snapshots
// dependerian de la maquina que ejecuta las pruebas.
export const FIXED_TIME_ZONE = "UTC";

async function withFixedClock<T>(callback: () => Promise<T>): Promise<T> {
  const previousTimeZone = process.env.TZ;

  process.env.TZ = FIXED_TIME_ZONE;
  vi.useFakeTimers({ toFake: ["Date"], now: FIXED_NOW });

  try {
    return await callback();
  } finally {
    vi.useRealTimers();

    if (previousTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTimeZone;
    }
  }
}

type SearchParams = Record<string, string | string[]>;

export type PageCase = {
  name: string;
  params?: Record<string, string | string[]>;
  searchParams?: SearchParams;
  role?: Role;
  data?: DataOverrides;
};

type PageProps = {
  params: Promise<Record<string, string | string[]>>;
  searchParams: Promise<SearchParams>;
};

type PageModule = {
  default: (props: PageProps) => ReactNode | Promise<ReactNode>;
};

export type PageLoader = () => Promise<unknown>;

export type PageResult = {
  calls: RecordedCall[];
  outcome: string;
  html: string | null;
};

// Intl.DateTimeFormat separa "p. m." con un espacio normal o con uno de no
// separacion segun la version de ICU que trae Node: con Node 20 e ICU 77 en
// Windows sale U+00A0 y en el CI sale U+0020. Se unifican para que los
// snapshots no dependan de la maquina.
const INTL_SPACES = /[\u00A0\u202F\u2009]/g;

export function normalizeIntlSpaces(text: string) {
  return text.replace(INTL_SPACES, " ");
}

// Aplica normalizeIntlSpaces a los textos de arreglos y objetos planos, sin
// tocar fechas, Decimal ni otras instancias.
export function normalizeIntlStrings(value: unknown): unknown {
  if (typeof value === "string") {
    return normalizeIntlSpaces(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeIntlStrings);
  }

  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeIntlStrings(item)]),
    );
  }

  return value;
}

export function normalizeHtml(html: string) {
  return normalizeIntlSpaces(
    html
      .replace(/<svg\b[\s\S]*?<\/svg>/g, "<svg/>")
      .replace(/ (?:class|style|data-slot|data-size)="[^"]*"/g, ""),
  ).replace(/></g, ">\n<");
}

function toSearchString(searchParams: SearchParams) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      search.append(key, item);
    }
  }

  return search.toString();
}

// Las funciones notFound() y redirect() de Next lanzan errores con un digest
// conocido. Cualquier otro error se propaga: la pagina fallo de verdad.
export function describeNavigationError(error: unknown) {
  const digest =
    error && typeof error === "object" && "digest" in error
      ? String((error as { digest: unknown }).digest)
      : "";

  if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404")) {
    return "notFound";
  }

  if (digest.startsWith("NEXT_REDIRECT;")) {
    return `redirect:${digest.split(";")[2]}`;
  }

  return null;
}

function resetState(pageCase: PageCase, pathname: string) {
  state.calls = [];
  state.data = pageCase.data ?? {};
  state.role = pageCase.role ?? "ADMIN";
  state.rejectAuth = false;
  state.pathname = pathname;
  state.search = toSearchString(pageCase.searchParams ?? {});
  state.params = pageCase.params ?? {};
}

async function runPage(load: PageLoader, pageCase: PageCase) {
  const { default: Page } = (await load()) as PageModule;

  return Page({
    params: Promise.resolve(pageCase.params ?? {}),
    searchParams: Promise.resolve(pageCase.searchParams ?? {}),
  });
}

export async function characterizePage(
  load: PageLoader,
  pageCase: PageCase,
  pathname = "/",
): Promise<PageResult> {
  resetState(pageCase, pathname);

  return withFixedClock(async () => {
    try {
      const tree = await runPage(load, pageCase);

      return {
        calls: [...state.calls],
        outcome: "render",
        html: normalizeHtml(renderToStaticMarkup(tree)),
      };
    } catch (error) {
      const outcome = describeNavigationError(error);

      if (!outcome) {
        throw error;
      }

      return { calls: [...state.calls], outcome, html: null };
    }
  });
}

// Ejecuta la pagina con la autorizacion rechazada y devuelve las llamadas que
// alcanzo a hacer. Una pagina correcta no toca Prisma.
export async function runWithRejectedAuth(
  load: PageLoader,
  pageCase: PageCase,
  pathname = "/",
) {
  resetState(pageCase, pathname);
  state.rejectAuth = true;

  return withFixedClock(async () => {
    try {
      await runPage(load, pageCase);
    } catch (error) {
      if (!(error instanceof AuthRejected)) {
        throw error;
      }

      return [...state.calls];
    }

    throw new Error("La pagina termino sin pasar por la autorizacion.");
  });
}

// Ejecuta cualquier funcion del servidor (por ejemplo, un route handler) con
// el mismo reloj, zona horaria y registro de llamadas que characterizePage.
export async function characterizeHandler<T>(
  run: () => Promise<T>,
  data: DataOverrides = {},
): Promise<{ calls: RecordedCall[]; result: T }> {
  resetState({ name: "handler", data }, "/");

  return withFixedClock(async () => {
    const result = await run();

    return { calls: [...state.calls], result };
  });
}

export function isPrismaCall(call: RecordedCall): call is PrismaCall {
  return "prisma" in call;
}

export function expectAuthorizesBeforePrisma(calls: RecordedCall[]) {
  const firstAuthz = calls.findIndex((call) => "authz" in call);
  const firstPrisma = calls.findIndex(isPrismaCall);

  expect(firstAuthz).toBeGreaterThanOrEqual(0);

  if (firstPrisma >= 0) {
    expect(firstAuthz).toBeLessThan(firstPrisma);
  }
}

// ---------------------------------------------------------------------------
// Suite generica por pagina
// ---------------------------------------------------------------------------

// La primera importacion de una pagina transforma todos sus componentes y
// puede superar el plazo por defecto de una prueba. Se precarga una vez.
const PRELOAD_TIMEOUT_MS = 120_000;

export function preloadPages(...loaders: PageLoader[]) {
  beforeAll(async () => {
    await Promise.all(loaders.map((load) => load()));
  }, PRELOAD_TIMEOUT_MS);
}

export type PageSpec = {
  route: string;
  load: PageLoader;
  cases: PageCase[];
};

// Para cada pagina y caso fija en snapshots las llamadas y el HTML, exige que
// la autorizacion ocurra antes de cualquier consulta y que un acceso rechazado
// no toque Prisma.
export function definePageSuite(pages: PageSpec[]) {
  preloadPages(...pages.map((page) => page.load));

  for (const page of pages) {
    describe(page.route, () => {
      for (const pageCase of page.cases) {
        it(pageCase.name, async () => {
          const result = await characterizePage(page.load, pageCase, page.route);

          expectAuthorizesBeforePrisma(result.calls);
          expect(result.calls).toMatchSnapshot("llamadas");
          expect({ outcome: result.outcome, html: result.html }).toMatchSnapshot(
            "resultado",
          );
        });
      }

      it("un acceso rechazado no consulta Prisma", async () => {
        const calls = await runWithRejectedAuth(
          page.load,
          page.cases[0] ?? { name: "rechazo" },
          page.route,
        );

        expect(calls.filter(isPrismaCall)).toEqual([]);
      });
    });
  }
}
