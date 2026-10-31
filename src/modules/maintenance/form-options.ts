// Lo que las paginas y los paneles de alta de Mantenimiento comparten para
// llenar sus formularios: las fechas por defecto y las opciones de maquina.

type MachineOption = {
  id_maquina: string;
  nombre: string;
  tipo: string;
  estado: string;
};

function getLocalIsoValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  return now.toISOString();
}

/** Valor de un input type="datetime-local" con el momento actual. */
export function getCurrentDateTimeValue() {
  return getLocalIsoValue().slice(0, 16);
}

/** Valor de un input type="date" con el dia actual. */
export function getTodayValue() {
  return getLocalIsoValue().slice(0, 10);
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

export function buildMachineOptionItems(machines: MachineOption[]) {
  return machines.map((machine) => ({
    id: machine.id_maquina,
    label: machine.nombre,
    description: `${machine.tipo} - ${getMachineStatusLabel(machine.estado)}`,
  }));
}
