import { describe, expect, it } from "vitest";

import { attendanceSchema } from "@/schemas/staff/attendance.schema";
import { operatorSchema } from "@/schemas/staff/operator.schema";
import { operatorTaskSchema } from "@/schemas/staff/operator-task.schema";

// Esquemas de Personal (A5 de la 10.8a). Fijan los hallazgos 68 (fechas que no
// existen), 69 (tarifa sin maximo), 70 (alta de tarea anulada) y 73 (mensajes de
// Zod en ingles cuando falta un campo). Un POST hecho a mano puede omitir
// cualquier campo: formData.get devuelve null.

type Parse = { safeParse: (value: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } };

function errorsOf(schema: Parse, value: Record<string, unknown>) {
  const result = schema.safeParse(value);

  return result.success
    ? {}
    : Object.fromEntries(result.error!.issues.map((issue) => [issue.path.join("."), issue.message]));
}

function messagesOf(schema: Parse, value: Record<string, unknown>) {
  return Object.values(errorsOf(schema, value));
}

const operator = {
  nombres: "Luis",
  apellidos: "Huaman",
  cargo: "",
  especialidad: "",
  telefono: "",
  direccion: "",
  modalidad_pago: "semanal",
  tarifa: "80.50",
  fecha_ingreso: "2026-03-02",
  estado: "activo",
  observaciones: "",
};

const attendance = {
  id_operario: "OPE00000003",
  fecha: "2026-07-15",
  hora_ingreso: "08:00",
  hora_salida: "17:00",
  tardanza: null,
  falta: null,
  observaciones: "",
};

const task = {
  id_operario: "OPE00000003",
  id_orden_trabajo: "OTR00000006",
  id_etapa_ruta: "",
  fecha_tarea: "2026-07-15",
  descripcion: "Corte de piezas",
  horas_dedicadas: "4.5",
  estado: "registrada",
  observaciones: "",
};

describe("operatorSchema", () => {
  it("rechaza una fecha de ingreso que no existe (hallazgo 68)", () => {
    expect(errorsOf(operatorSchema, { ...operator, fecha_ingreso: "2026-02-30" })).toEqual({
      fecha_ingreso: "La fecha de ingreso no es válida.",
    });
  });

  it("rechaza una tarifa mayor que la columna (hallazgo 69)", () => {
    expect(errorsOf(operatorSchema, { ...operator, tarifa: "10000000000" })).toEqual({
      tarifa: "La tarifa no debe superar S/ 9,999,999,999.99.",
    });
  });

  it("acepta la tarifa maxima de la columna", () => {
    expect(errorsOf(operatorSchema, { ...operator, tarifa: "9999999999.99" })).toEqual({});
  });

  it("responde en espanol cuando faltan los campos obligatorios (hallazgo 73)", () => {
    expect(
      errorsOf(operatorSchema, { ...operator, nombres: null, apellidos: null, modalidad_pago: null }),
    ).toEqual({
      nombres: "Los nombres son obligatorios.",
      apellidos: "Los apellidos son obligatorios.",
      modalidad_pago: "Seleccione una modalidad de pago válida.",
    });
  });
});

describe("attendanceSchema", () => {
  it.each(["2026-02-30", "abc", "2026-7-15"])("rechaza la fecha %s (hallazgo 68)", (fecha) => {
    expect(errorsOf(attendanceSchema, { ...attendance, fecha })).toEqual({
      fecha: "La fecha de asistencia no es válida.",
    });
  });

  it("responde en espanol cuando faltan el operario y la fecha (hallazgo 73)", () => {
    expect(errorsOf(attendanceSchema, { ...attendance, id_operario: null, fecha: null })).toEqual({
      id_operario: "Debe seleccionar un operario.",
      fecha: "La fecha de asistencia es obligatoria.",
    });
  });
});

describe("operatorTaskSchema", () => {
  it("rechaza una fecha de tarea que no existe (hallazgo 68)", () => {
    expect(errorsOf(operatorTaskSchema, { ...task, fecha_tarea: "2026-02-30" })).toEqual({
      fecha_tarea: "La fecha de la tarea no es válida.",
    });
  });

  it("el alta no acepta una tarea anulada (hallazgo 70)", () => {
    expect(errorsOf(operatorTaskSchema, { ...task, estado: "anulada" })).toEqual({
      estado: "Seleccione un estado válido para la tarea.",
    });
  });

  it.each(["registrada", "en_proceso", "terminada"])("acepta el estado inicial %s", (estado) => {
    expect(errorsOf(operatorTaskSchema, { ...task, estado })).toEqual({});
  });

  it("responde en espanol cuando faltan los campos obligatorios (hallazgo 73)", () => {
    const messages = messagesOf(operatorTaskSchema, {
      ...task,
      id_operario: null,
      id_orden_trabajo: null,
      fecha_tarea: null,
      descripcion: null,
      estado: null,
    });

    expect(messages).toEqual([
      "Debe seleccionar un operario.",
      "Debe seleccionar una orden de trabajo.",
      "La fecha de la tarea es obligatoria.",
      "La descripción es obligatoria.",
      "Seleccione un estado válido para la tarea.",
    ]);
  });
});
