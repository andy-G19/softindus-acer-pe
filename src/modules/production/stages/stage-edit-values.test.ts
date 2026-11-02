import { describe, expect, it } from "vitest";

import { formatDecimalInput, getStageEditValues } from "@/modules/production/stages/stage-edit-values";

const STAGE = {
  id_etapa_ruta: "ETA00000006",
  nombre_etapa: "Corte de plancha",
  orden_secuencia: 3,
  descripcion: null,
  tiempo_operario_minutos_unidad: "8.50",
  modo_tiempo: "secuencial",
  requiere_maquina: true,
  etapa_ruta_maquina: [{ id_maquina: "MAQ00000002", tiempo_maquina_minutos_unidad: "6.00" }],
};

describe("getStageEditValues", () => {
  it("abre el formulario con lo guardado, en texto", () => {
    expect(getStageEditValues(STAGE)).toEqual({
      id_etapa_ruta: "ETA00000006",
      nombre_etapa: "Corte de plancha",
      orden_secuencia: "3",
      descripcion: "",
      tiempo_operario_minutos_unidad: "8.5",
      id_maquina: "MAQ00000002",
      tiempo_maquina_minutos_unidad: "6",
      modo_tiempo: "secuencial",
      requiere_maquina: true,
    });
  });

  it("sin maquina deja vacios sus campos", () => {
    expect(getStageEditValues({ ...STAGE, etapa_ruta_maquina: [] })).toMatchObject({
      id_maquina: "",
      tiempo_maquina_minutos_unidad: "",
    });
  });
});

describe("formatDecimalInput", () => {
  it.each([
    [null, ""],
    [undefined, ""],
    ["8.50", "8.5"],
    [4, "4"],
  ])("%s da %j", (value, expected) => {
    expect(formatDecimalInput(value)).toBe(expected);
  });
});
