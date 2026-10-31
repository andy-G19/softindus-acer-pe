// Lo que la pagina y el panel de alta de fallas comparten para llenar el
// formulario: la fecha y hora por defecto y las opciones de maquina.

type FailureMachine = {
  id_maquina: string;
  nombre: string;
  tipo: string;
  estado: string;
};

export function getCurrentDateTimeValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  return now.toISOString().slice(0, 16);
}

function getMachineStatusLabel(status: string) {
  const labels: Record<string, string> = {
    operativa: "Operativa",
    en_reparacion: "En mantenimiento",
    inactiva: "Inactiva",
    dada_de_baja: "Fuera de servicio",
  };

  return labels[status] ?? status;
}

export function buildFailureMachineItems(machines: FailureMachine[]) {
  return machines.map((machine) => ({
    id: machine.id_maquina,
    label: machine.nombre,
    description: `${machine.tipo} - ${getMachineStatusLabel(machine.estado)}`,
  }));
}
