import { formatDate } from "@/lib/formatters";
import type { OperatorTaskFormValues } from "@/modules/staff/tasks/actions";

/**
 * Una tarea nueva empieza sin operario, orden ni etapa, registrada y con la fecha
 * de hoy (dia UTC, como la pagina de alta antes de la 10.8a).
 */
export function newTaskFormValues(today = new Date()): OperatorTaskFormValues {
  return {
    id_operario: "",
    id_orden_trabajo: "",
    id_etapa_ruta: "",
    fecha_tarea: today.toISOString().split("T")[0],
    descripcion: "",
    horas_dedicadas: "",
    estado: "registrada",
    observaciones: "",
  };
}

type TaskFormData = {
  operators: { id_operario: string; nombres: string; apellidos: string; cargo: string | null }[];
  workOrders: {
    id_orden_trabajo: string;
    cantidad: { toString(): string };
    estado: string;
    fecha_inicio: Date | null;
    producto: { nombre_producto: string };
  }[];
  stages: {
    id_etapa_ruta: string;
    nombre_etapa: string;
    orden_secuencia: number;
    ruta_fabricacion: { nombre_ruta: string; producto: { nombre_producto: string } };
  }[];
};

/** Las opciones de los buscadores, las mismas en el panel y en la pagina. */
export function taskFormOptions({ operators, workOrders, stages }: TaskFormData) {
  return {
    operators: operators.map((operator) => ({
      id: operator.id_operario,
      label: `${operator.apellidos}, ${operator.nombres}`,
      description: operator.cargo ?? "Sin cargo",
    })),
    workOrders: workOrders.map((order) => ({
      id: order.id_orden_trabajo,
      label: `${order.id_orden_trabajo} - ${order.producto.nombre_producto}`,
      description: `Cantidad: ${order.cantidad.toString()} - Estado: ${order.estado} - Inicio: ${formatDate(order.fecha_inicio, { format: "dd/mm/yyyy" })}`,
    })),
    stages: stages.map((stage) => ({
      id: stage.id_etapa_ruta,
      label: `${stage.ruta_fabricacion.producto.nombre_producto} - ${stage.nombre_etapa}`,
      description: `${stage.ruta_fabricacion.nombre_ruta} - Secuencia ${stage.orden_secuencia}`,
    })),
  };
}
