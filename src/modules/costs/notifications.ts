import type { NotificationCatalog } from "@/lib/notification-catalog";

// Avisos de las acciones de Costos. Desde la 10.8b las paginas los pasan con su clave
// literal a los formularios y botones que los dan; el registro comun los reune en
// src/modules/notification-registry.ts.
export const costsNotifications = {
  "indirect-cost-created": { type: "success", message: "Costo indirecto agregado correctamente" },
  "indirect-cost-annulled": { type: "warning", message: "Costo indirecto anulado" },
  "costing-created": { type: "success", message: "Costeo creado correctamente" },
  "costing-updated": { type: "success", message: "Costeo actualizado correctamente" },
  "costing-recalculated": { type: "success", message: "Costeo recalculado correctamente" },
  "profitability-created": { type: "success", message: "Rentabilidad calculada correctamente" },
  "margin-created": { type: "success", message: "Margen aplicado correctamente" },
  // B6 de la 10.8b (D5): generar desde una lista vieja o con doble clic abre el costeo
  // que la orden ya tenia.
  "costing-already-exists": { type: "info", message: "La orden ya tenía un costeo: se abrió el existente" },
} satisfies NotificationCatalog;
