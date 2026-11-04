import type { AttendanceFormValues } from "@/modules/staff/attendance/actions";

/**
 * Un registro de asistencia nuevo empieza sin operario y con la fecha de hoy (dia
 * UTC, como la pagina de alta antes de la 10.8a).
 */
export function newAttendanceFormValues(today = new Date()): AttendanceFormValues {
  return {
    id_operario: "",
    fecha: today.toISOString().split("T")[0],
    hora_ingreso: "",
    hora_salida: "",
    tardanza: false,
    falta: false,
    observaciones: "",
  };
}

/** Los operarios activos como opciones del buscador, los mismos en el panel y en la pagina. */
export function operatorOptions(
  operators: { id_operario: string; nombres: string; apellidos: string; cargo: string | null }[],
) {
  return operators.map((operator) => ({
    id: operator.id_operario,
    label: `${operator.apellidos}, ${operator.nombres}`,
    description: operator.cargo ?? "Sin cargo",
  }));
}
