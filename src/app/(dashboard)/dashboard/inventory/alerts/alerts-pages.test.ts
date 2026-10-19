import { vi } from "vitest";

import {
  definePageSuite,
  projectRows,
  type DataOverrides,
  type PrismaArgs,
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

// Caracterizacion de Alertas de stock (entrega 4.3), escrita antes
// de mover sus consultas a modules/inventory/alerts/queries.ts. Los datos
// generados no tienen ninguna alerta activa: los casos «con una alerta activa»
// (entrega 10.3) muestran la accion de atender, que solo ve ADMIN.

const MATERIALS = [
  {
    id_material: "MAT00000004",
    nombre_material: "Plancha LAC 1/16",
    categoria: "planchas",
    unidad_medida: "unidad",
    stock_actual: 2,
    stock_reservado: 0,
    stock_minimo: 5,
  },
];

const ALERTS = [
  {
    id_alerta: "ALE00000003",
    id_material: "MAT00000004",
    fecha_alerta: new Date("2026-07-10T14:00:00.000Z"),
    estado_alerta: "activa",
    mensaje: "El material Plancha LAC 1/16 está en stock bajo.",
    stock_detectado: 2,
    stock_minimo: 5,
  },
  {
    id_alerta: "ALE00000002",
    id_material: "MAT00000004",
    fecha_alerta: new Date("2026-07-01T14:00:00.000Z"),
    estado_alerta: "atendida",
    mensaje: "El material Plancha LAC 1/16 recupero stock por encima del minimo.",
    stock_detectado: 9,
    stock_minimo: 5,
  },
];

const WITH_ACTIVE_ALERT: DataOverrides = {
  "material.findMany": (args: PrismaArgs) => projectRows(MATERIALS, args),
  "alerta_stock.findMany": (args: PrismaArgs) => projectRows(ALERTS, args),
};

definePageSuite([
  {
    route: "/dashboard/inventory/alerts",
    load: () => import("./page"),
    cases: [
      { name: "administrador" },
      { name: "maestro de taller", role: "WORKSHOP_MASTER" },
      { name: "administrador con una alerta activa", data: WITH_ACTIVE_ALERT },
      { name: "maestro de taller con una alerta activa", role: "WORKSHOP_MASTER", data: WITH_ACTIVE_ALERT },
    ],
  },
]);
