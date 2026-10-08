import type { NotificationCatalog } from "@/lib/notification-catalog";

// Mensajes que el puente ?toast= muestra tras las acciones de Personal que
// redirigen con ?toast=<clave>. El registro comun los reune en
// src/modules/notification-registry.ts.
export const staffNotifications = {
  "operator-created": { type: "success", message: "Operario guardado correctamente" },
  "operator-updated": { type: "success", message: "Operario actualizado correctamente" },
  "operator-activated": { type: "success", message: "Operario activado" },
  "operator-deactivated": { type: "warning", message: "Operario desactivado" },
  "payroll-created": { type: "success", message: "Planilla generada correctamente" },
  "payroll-annulled": { type: "warning", message: "Planilla anulada" },
  "operator-task-created": { type: "success", message: "Tarea registrada correctamente" },
  "operator-task-annulled": { type: "warning", message: "Tarea anulada" },
  "attendance-created": { type: "success", message: "Asistencia registrada correctamente" },
  "operator-payment-registered": { type: "success", message: "Pago a operario registrado correctamente" },
} satisfies NotificationCatalog;
