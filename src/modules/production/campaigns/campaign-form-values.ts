import type { ProductionCampaignFormValues } from "@/modules/production/campaigns/actions";

/** Fecha de un input type="date"; las columnas date llegan como medianoche UTC. */
function toDateField(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

/** Una campana nueva empieza hoy y nace planificada. */
export function newCampaignFormValues(): ProductionCampaignFormValues {
  return {
    nombre_campania: "",
    fecha_inicio: toDateField(new Date()),
    fecha_fin: "",
    objetivo_general: "",
    estado: "planificada",
  };
}

/** Los valores del formulario de edicion, los mismos en el panel y en la pagina. */
export function campaignEditFormValues(campaign: {
  id_campania: string;
  nombre_campania: string;
  fecha_inicio: Date;
  fecha_fin: Date | null;
  objetivo_general: string | null;
  estado: string;
}) {
  return {
    id_campania: campaign.id_campania,
    nombre_campania: campaign.nombre_campania,
    fecha_inicio: toDateField(campaign.fecha_inicio),
    fecha_fin: toDateField(campaign.fecha_fin),
    objetivo_general: campaign.objetivo_general ?? "",
    estado: campaign.estado,
  };
}
