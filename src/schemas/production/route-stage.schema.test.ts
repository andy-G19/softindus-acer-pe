import { describe, expect, it } from "vitest";

import { routeStageSchema } from "@/schemas/production/route-stage.schema";

/**
 * Base valida minima. Cada prueba la sobrescribe con el caso que quiere verificar.
 * Los valores llegan como strings porque en la app vienen de un FormData.
 */
function buildInput(overrides: Record<string, unknown> = {}) {
  return {
    id_ruta: "RUT00000002",
    nombre_etapa: "Corte de plancha",
    orden_secuencia: "1",
    descripcion: "",
    tiempo_operario_minutos_unidad: "8",
    id_maquina: "",
    tiempo_maquina_minutos_unidad: "",
    modo_tiempo: undefined,
    requiere_maquina: false,
    ...overrides,
  };
}

function fieldErrors(input: Record<string, unknown>) {
  const parsed = routeStageSchema.safeParse(input);

  if (parsed.success) {
    return null;
  }

  return parsed.error.flatten().fieldErrors;
}

describe("routeStageSchema · tiempos", () => {
  it("acepta una etapa manual con solo tiempo de operario", () => {
    const parsed = routeStageSchema.safeParse(buildInput());

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.tiempo_operario_minutos_unidad).toBe(8);
      expect(parsed.data.id_maquina).toBeNull();
      expect(parsed.data.tiempo_maquina_minutos_unidad).toBeUndefined();
    }
  });

  it("permite dejar el tiempo de operario vacio", () => {
    const parsed = routeStageSchema.safeParse(
      buildInput({ tiempo_operario_minutos_unidad: "" }),
    );

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.tiempo_operario_minutos_unidad).toBeUndefined();
    }
  });

  it("rechaza tiempo de operario en cero", () => {
    const errors = fieldErrors(
      buildInput({ tiempo_operario_minutos_unidad: "0" }),
    );

    expect(errors?.tiempo_operario_minutos_unidad?.[0]).toContain(
      "mayor que cero",
    );
  });

  it("rechaza tiempo de operario negativo", () => {
    const errors = fieldErrors(
      buildInput({ tiempo_operario_minutos_unidad: "-3" }),
    );

    expect(errors?.tiempo_operario_minutos_unidad).toBeDefined();
  });

  it("rechaza tiempos por encima del tope de 9999.99 minutos", () => {
    const errors = fieldErrors(
      buildInput({ tiempo_operario_minutos_unidad: "10000" }),
    );

    expect(errors?.tiempo_operario_minutos_unidad).toBeDefined();
  });
});

describe("routeStageSchema · reglas cruzadas de maquina", () => {
  it("exige tiempo de maquina cuando se selecciona una maquina", () => {
    const errors = fieldErrors(
      buildInput({
        id_maquina: "MAQ00000001",
        tiempo_maquina_minutos_unidad: "",
      }),
    );

    expect(errors?.tiempo_maquina_minutos_unidad?.[0]).toContain(
      "minutos de máquina",
    );
  });

  it("rechaza tiempo de maquina sin maquina seleccionada", () => {
    const errors = fieldErrors(
      buildInput({
        id_maquina: "",
        tiempo_maquina_minutos_unidad: "6",
      }),
    );

    expect(errors?.tiempo_maquina_minutos_unidad?.[0]).toContain(
      "sin seleccionar una máquina",
    );
  });

  it("acepta maquina con su tiempo", () => {
    const parsed = routeStageSchema.safeParse(
      buildInput({
        id_maquina: "MAQ00000001",
        tiempo_maquina_minutos_unidad: "6",
      }),
    );

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.id_maquina).toBe("MAQ00000001");
      expect(parsed.data.tiempo_maquina_minutos_unidad).toBe(6);
    }
  });

  it("fuerza requiere_maquina a true cuando hay maquina asignada", () => {
    // El formulario deshabilita la casilla en ese caso, y una casilla deshabilitada no
    // viaja en el FormData: el invariante tiene que sostenerlo el schema.
    const parsed = routeStageSchema.safeParse(
      buildInput({
        id_maquina: "MAQ00000001",
        tiempo_maquina_minutos_unidad: "6",
        requiere_maquina: false,
      }),
    );

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.requiere_maquina).toBe(true);
    }
  });

  it("respeta requiere_maquina en true sin maquina asignada todavia", () => {
    const parsed = routeStageSchema.safeParse(
      buildInput({ requiere_maquina: true }),
    );

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.requiere_maquina).toBe(true);
      expect(parsed.data.id_maquina).toBeNull();
    }
  });
});

describe("routeStageSchema · modo de tiempo", () => {
  it("usa simultaneo cuando no se envia modo", () => {
    const parsed = routeStageSchema.safeParse(buildInput());

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.modo_tiempo).toBe("simultaneo");
    }
  });

  it("acepta secuencial", () => {
    const parsed = routeStageSchema.safeParse(
      buildInput({ modo_tiempo: "secuencial" }),
    );

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.modo_tiempo).toBe("secuencial");
    }
  });

  it("rechaza un modo inventado", () => {
    const errors = fieldErrors(buildInput({ modo_tiempo: "paralelo" }));

    expect(errors?.modo_tiempo).toBeDefined();
  });
});

describe("routeStageSchema · campos base", () => {
  it("rechaza nombres de menos de 3 caracteres", () => {
    const errors = fieldErrors(buildInput({ nombre_etapa: "AB" }));

    expect(errors?.nombre_etapa).toBeDefined();
  });

  it("rechaza orden de secuencia menor a 1", () => {
    const errors = fieldErrors(buildInput({ orden_secuencia: "0" }));

    expect(errors?.orden_secuencia).toBeDefined();
  });

  it("convierte la descripcion vacia en null", () => {
    const parsed = routeStageSchema.safeParse(buildInput({ descripcion: "" }));

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.descripcion).toBeNull();
    }
  });
});
