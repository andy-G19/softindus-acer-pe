import type { MachineFormValues } from "@/modules/maintenance/machines/actions";

type EditableMachine = {
  id_maquina: string;
  nombre: string;
  tipo: string;
  codigo_interno: string | null;
  ubicacion: string | null;
  estado: string;
  observaciones: string | null;
};

// Valores con los que el formulario abre la edicion de una maquina (entrega
// 10.5a): lo que falta, vacio. Los usan la pagina de edicion y su panel
// lateral, que muestran el mismo formulario.
export function getMachineEditValues(machine: EditableMachine): MachineFormValues & { id_maquina: string } {
  return {
    id_maquina: machine.id_maquina,
    nombre: machine.nombre,
    tipo: machine.tipo,
    codigo_interno: machine.codigo_interno ?? "",
    ubicacion: machine.ubicacion ?? "",
    estado: machine.estado,
    observaciones: machine.observaciones ?? "",
  };
}
