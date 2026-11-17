import { describe, expect, it } from "vitest";

import { normalizeProgressPercentage } from "@/lib/progress-percentage";

// El porcentaje de avance de una etapa (C2 de la 11.6c, D79). La regla no cambia: pendiente 0,
// terminada 100, y en proceso o pausada mas de 0 y menos de 100 (0 o menos sube a 1, 100 o mas
// baja a 99). La columna es numeric(5, 2) y redondea por su cuenta, asi que la regla se aplica
// sobre el numero ya redondeado en centesimos: antes, 99.995 «en proceso» pasaba la regla (menor
// que 100) y se guardaba como 100.00, y 0.004 pasaba (mayor que 0) y se guardaba como 0.00. La
// pagina usa la misma funcion para el valor inicial del campo.

describe("normalizeProgressPercentage", () => {
  it.each([
    ["pendiente", 50, 0],
    ["terminada", 40, 100],
    ["en_proceso", 45, 45],
    ["en_proceso", 0, 1],
    ["en_proceso", 100, 99],
    ["pausada", 100, 99],
    ["pausada", 0, 1],
  ])("%s con %s queda en %s", (estado, porcentaje, esperado) => {
    expect(normalizeProgressPercentage(estado, porcentaje)).toBe(esperado);
  });

  it.each([
    ["en_proceso", 99.995, 99],
    ["pausada", 99.995, 99],
    ["en_proceso", 0.004, 1],
    ["pausada", 0.004, 1],
  ])("%s con %s se redondea como la columna antes de la regla: %s", (estado, porcentaje, esperado) => {
    expect(normalizeProgressPercentage(estado, porcentaje)).toBe(esperado);
  });

  it.each([
    ["en_proceso", 45.678, 45.68],
    ["en_proceso", 0.005, 0.01],
    ["pausada", 98.994, 98.99],
    ["en_proceso", 1.005, 1.01],
  ])("%s con %s guarda lo que guardaria la columna: %s", (estado, porcentaje, esperado) => {
    expect(normalizeProgressPercentage(estado, porcentaje)).toBe(esperado);
  });
});
