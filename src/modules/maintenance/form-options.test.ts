import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildMachineOptionItems,
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
