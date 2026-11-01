import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  buildMachineOptionItems,
  buildSparePartOptionItems,
  getCurrentDateTimeValue,
  getTodayValue,
} from "@/modules/maintenance/form-options";

describe("opciones de maquina", () => {
  // La descripcion de una opcion no llega al HTML del servidor (la lista del
  // SearchableSelect esta cerrada): se prueba aqui.
  it.each([
    ["operativa", "torno - Operativa"],
    ["en_reparacion", "torno - En mantenimiento"],
    ["inactiva", "torno - Inactiva"],
    ["dada_de_baja", "torno - Fuera de servicio"],
    ["otro", "torno - otro"],
  ])("una maquina %s", (estado, description) => {
    expect(
      buildMachineOptionItems([{ id_maquina: "MAQ00000001", nombre: "Torno paralelo", tipo: "torno", estado }]),
    ).toEqual([{ id: "MAQ00000001", label: "Torno paralelo", description }]);
  });
});

describe("opciones de repuesto", () => {
  it("llevan el costo del catalogo como texto, sin pasar por coma flotante", () => {
    expect(
      buildSparePartOptionItems([
        { id_repuesto: "REP00000001", nombre_repuesto: "Rodamiento 6205", costo_unitario: new Prisma.Decimal("10.25") },
      ]),
    ).toEqual([{ id: "REP00000001", label: "Rodamiento 6205", description: "S/ 10.25", costo_unitario: "10.25" }]);
  });
});

describe("fechas por defecto", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-07-15T15:30:45.000Z") });
    vi.stubEnv("TZ", "UTC");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("la fecha y hora tienen el formato de datetime-local", () => {
    expect(getCurrentDateTimeValue()).toBe("2026-07-15T15:30");
  });

  it("la fecha tiene el formato de un input type=date", () => {
    expect(getTodayValue()).toBe("2026-07-15");
  });
});
