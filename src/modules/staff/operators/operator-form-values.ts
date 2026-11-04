import type { OperatorFormValues } from "@/modules/staff/operators/actions";

/**
 * Un operario nuevo empieza sin datos, con la modalidad semanal y la fecha de
 * ingreso de hoy (dia UTC, como la pagina de alta antes de la 10.8a).
 */
export function newOperatorFormValues(today = new Date()): OperatorFormValues {
  return {
    nombres: "",
    apellidos: "",
    cargo: "",
    especialidad: "",
    telefono: "",
    direccion: "",
    modalidad_pago: "semanal",
    tarifa: "",
    fecha_ingreso: today.toISOString().split("T")[0],
    observaciones: "",
  };
}

/** Los valores del formulario de edicion, los mismos en el panel y en la pagina. */
export function operatorEditFormValues(operator: {
  id_operario: string;
  nombres: string;
  apellidos: string;
  cargo: string | null;
  especialidad: string | null;
  telefono: string | null;
  direccion: string | null;
  modalidad_pago: string;
  tarifa: { toString(): string } | null;
  fecha_ingreso: Date | null;
  observaciones: string | null;
}) {
  return {
    id_operario: operator.id_operario,
    nombres: operator.nombres,
    apellidos: operator.apellidos,
    cargo: operator.cargo ?? "",
    especialidad: operator.especialidad ?? "",
    telefono: operator.telefono ?? "",
    direccion: operator.direccion ?? "",
    modalidad_pago: operator.modalidad_pago,
    tarifa: operator.tarifa?.toString() ?? "",
    fecha_ingreso: operator.fecha_ingreso ? operator.fecha_ingreso.toISOString().split("T")[0] : "",
    observaciones: operator.observaciones ?? "",
  };
}
