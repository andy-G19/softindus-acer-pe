// Regla de la pantalla para corregir los materiales de una version (entrega 10.6b,
// hallazgo 8). La lista, el alta y la edicion la comparten para no separarse: la
// accion aplica la misma regla con la fila bloqueada. Solo se puede corregir mientras
// ninguna orden haya usado la version.

type VersionForRules = {
  estado: string;
  receta_tecnica: { estado: string };
  _count: { orden_trabajo: number };
};

export function canEditRecipeDetails(version: VersionForRules) {
  return (
    version.estado === "vigente" && version.receta_tecnica.estado === "activa" && version._count.orden_trabajo === 0
  );
}

/** La unidad de la linea es la del material cuando se escribio; el material pudo cambiar. */
export function hasUnitDrift(detailUnit: string, materialUnit: string) {
  return detailUnit.trim().toLowerCase() !== materialUnit.trim().toLowerCase();
}
