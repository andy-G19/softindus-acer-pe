import { describe, expect, it } from "vitest";

import {
  STAGE_TIME_MODES,
  getStageDurationForQuantity,
  getStageDurationPerUnit,
  getStageWorkload,
  isStageTimeMode,
} from "@/lib/production-times";

describe("getStageDurationPerUnit", () => {
  it("sin maquina, la etapa dura lo que trabaja el operario", () => {
    expect(
      getStageDurationPerUnit({
        operatorMinutes: 8,
        machineMinutes: null,
        mode: STAGE_TIME_MODES.SIMULTANEO,
      }),
    ).toBe(8);
  });

  it("sin maquina no suma aunque el modo sea secuencial", () => {
    expect(
      getStageDurationPerUnit({
        operatorMinutes: 8,
        machineMinutes: 0,
        mode: STAGE_TIME_MODES.SECUENCIAL,
      }),
    ).toBe(8);
  });

  it("simultaneo toma el mayor cuando el operario tarda mas", () => {
    expect(
      getStageDurationPerUnit({
        operatorMinutes: 8,
        machineMinutes: 6,
        mode: STAGE_TIME_MODES.SIMULTANEO,
      }),
    ).toBe(8);
  });

  it("simultaneo toma el mayor cuando la maquina tarda mas", () => {
    expect(
      getStageDurationPerUnit({
        operatorMinutes: 4,
        machineMinutes: 10,
        mode: STAGE_TIME_MODES.SIMULTANEO,
      }),
    ).toBe(10);
  });

  it("corte con cizalla: operario y maquina trabajan el mismo tiempo", () => {
    // Caso real del taller: el operario opera la cizalla toda la etapa, asi que los dos
    // tiempos son iguales y la etapa NO dura el doble.
    expect(
      getStageDurationPerUnit({
        operatorMinutes: 8,
        machineMinutes: 8,
        mode: STAGE_TIME_MODES.SIMULTANEO,
      }),
    ).toBe(8);
  });

  it("secuencial suma ambos tiempos", () => {
    expect(
      getStageDurationPerUnit({
        operatorMinutes: 5,
        machineMinutes: 40,
        mode: STAGE_TIME_MODES.SECUENCIAL,
      }),
    ).toBe(45);
  });

  it("un modo desconocido cae a simultaneo y nunca suma", () => {
    expect(
      getStageDurationPerUnit({
        operatorMinutes: 8,
        machineMinutes: 6,
        mode: "loquesea",
      }),
    ).toBe(8);
  });

  it("trata nulos, indefinidos y negativos como cero", () => {
    expect(
      getStageDurationPerUnit({
        operatorMinutes: null,
        machineMinutes: undefined,
        mode: STAGE_TIME_MODES.SIMULTANEO,
      }),
    ).toBe(0);

    expect(
      getStageDurationPerUnit({
        operatorMinutes: -5,
        machineMinutes: 6,
        mode: STAGE_TIME_MODES.SIMULTANEO,
      }),
    ).toBe(6);
  });

  it("acepta Decimal de Prisma (objeto con toString)", () => {
    const decimalLike = { toString: () => "7.50" };

    expect(
      getStageDurationPerUnit({
        operatorMinutes: decimalLike,
        machineMinutes: "6.25",
        mode: STAGE_TIME_MODES.SIMULTANEO,
      }),
    ).toBe(7.5);
  });
});

describe("getStageWorkload", () => {
  it("desglosa operario, maquina y duracion para la cantidad de la orden", () => {
    // Ejemplo del requerimiento: corte de 10 unidades, operario 8 min/u, cizalla 6 min/u.
    const workload = getStageWorkload({
      operatorMinutes: 8,
      machineMinutes: 6,
      mode: STAGE_TIME_MODES.SIMULTANEO,
      quantity: 10,
    });

    expect(workload.operatorMinutes).toBe(80);
    expect(workload.machineMinutes).toBe(60);
    // Trabajan a la vez: la etapa dura 80, no 140.
    expect(workload.durationMinutes).toBe(80);
  });

  it("en secuencial la duracion si acumula ambos tiempos", () => {
    const workload = getStageWorkload({
      operatorMinutes: 5,
      machineMinutes: 40,
      mode: STAGE_TIME_MODES.SECUENCIAL,
      quantity: 3,
    });

    expect(workload.operatorMinutes).toBe(15);
    expect(workload.machineMinutes).toBe(120);
    expect(workload.durationMinutes).toBe(135);
  });

  it("cantidad cero anula la carga sin romper el calculo", () => {
    const workload = getStageWorkload({
      operatorMinutes: 8,
      machineMinutes: 6,
      mode: STAGE_TIME_MODES.SIMULTANEO,
      quantity: 0,
    });

    expect(workload.operatorMinutes).toBe(0);
    expect(workload.machineMinutes).toBe(0);
    expect(workload.durationMinutes).toBe(0);
  });
});

describe("getStageDurationForQuantity", () => {
  it("coincide con la duracion del desglose", () => {
    const params = {
      operatorMinutes: 8,
      machineMinutes: 6,
      mode: STAGE_TIME_MODES.SIMULTANEO,
      quantity: 10,
    };

    expect(getStageDurationForQuantity(params)).toBe(
      getStageWorkload(params).durationMinutes,
    );
  });
});

describe("isStageTimeMode", () => {
  it("acepta solo los modos validos", () => {
    expect(isStageTimeMode("simultaneo")).toBe(true);
    expect(isStageTimeMode("secuencial")).toBe(true);
    expect(isStageTimeMode("paralelo")).toBe(false);
    expect(isStageTimeMode(null)).toBe(false);
    expect(isStageTimeMode(3)).toBe(false);
  });
});
