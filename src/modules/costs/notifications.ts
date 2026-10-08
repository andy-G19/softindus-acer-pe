import type { NotificationCatalog } from "@/lib/notification-catalog";

// Mensajes que el puente ?toast= muestra tras las acciones de Costos que
// redirigen con ?toast=<clave>. El registro comun los reune en
// src/modules/notification-registry.ts.
export const costsNotifications = {
  "indirect-cost-created": { type: "success", message: "Costo indirecto agregado correctamente" },
  "indirect-cost-annulled": { type: "warning", message: "Costo indirecto anulado" },
  "costing-created": { type: "success", message: "Costeo creado correctamente" },
  "costing-updated": { type: "success", message: "Costeo actualizado correctamente" },
  "costing-recalculated": { type: "success", message: "Costeo recalculado correctamente" },
  "profitability-created": { type: "success", message: "Rentabilidad calculada correctamente" },
  "margin-created": { type: "success", message: "Margen aplicado correctamente" },
} satisfies NotificationCatalog;
