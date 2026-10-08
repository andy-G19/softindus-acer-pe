import type { NotificationCatalog } from "@/lib/notification-catalog";

// Mensajes que el puente ?toast= muestra tras las acciones de Mantenimiento que
// redirigen con ?toast=<clave>. El registro comun los reune en
// src/modules/notification-registry.ts.
export const maintenanceNotifications = {
  "spare-part-created": { type: "success", message: "Repuesto guardado correctamente" },
  "spare-part-updated": { type: "success", message: "Repuesto actualizado correctamente" },
  "spare-part-activated": { type: "success", message: "Repuesto activado" },
  "spare-part-deactivated": { type: "warning", message: "Repuesto desactivado" },
  "machine-created": { type: "success", message: "Máquina guardada correctamente" },
  "machine-updated": { type: "success", message: "Máquina actualizada correctamente" },
  "machine-status-updated": { type: "success", message: "Estado de máquina actualizado" },
  "machine-activated": { type: "success", message: "Máquina activada" },
  "machine-deactivated": { type: "warning", message: "Máquina desactivada" },
  "failure-created": { type: "success", message: "Falla registrada correctamente" },
  "failure-updated": { type: "success", message: "Estado de falla actualizado" },
  "repair-created": { type: "success", message: "Reparación registrada correctamente" },
  "repair-updated": { type: "success", message: "Estado de reparación actualizado" },
  "preventive-maintenance-created": { type: "success", message: "Mantenimiento preventivo programado" },
  "preventive-maintenance-updated": { type: "success", message: "Estado de mantenimiento actualizado" },
} satisfies NotificationCatalog;
