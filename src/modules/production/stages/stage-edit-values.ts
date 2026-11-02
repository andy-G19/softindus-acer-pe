// Valores con que la pagina y el panel de edicion abren StageForm: los dos leen la
// misma consulta. Funcion pura.

export function formatDecimalInput(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return Number(value.toString()).toString();
}

type EditedStage = {
  id_etapa_ruta: string;
  nombre_etapa: string;
  orden_secuencia: number;
  descripcion: string | null;
  tiempo_operario_minutos_unidad: unknown;
  modo_tiempo: string;
  requiere_maquina: boolean;
  etapa_ruta_maquina: { id_maquina: string; tiempo_maquina_minutos_unidad: unknown }[];
};

export function getStageEditValues(stage: EditedStage) {
  const assignment = stage.etapa_ruta_maquina[0];

  return {
    id_etapa_ruta: stage.id_etapa_ruta,
    nombre_etapa: stage.nombre_etapa,
    orden_secuencia: String(stage.orden_secuencia),
    descripcion: stage.descripcion ?? "",
    tiempo_operario_minutos_unidad: formatDecimalInput(stage.tiempo_operario_minutos_unidad),
    id_maquina: assignment?.id_maquina ?? "",
    tiempo_maquina_minutos_unidad: formatDecimalInput(assignment?.tiempo_maquina_minutos_unidad),
    modo_tiempo: stage.modo_tiempo,
    requiere_maquina: stage.requiere_maquina,
  };
}
