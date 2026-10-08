import type { NotificationCatalog } from "@/lib/notification-catalog";

// Mensajes que el puente ?toast= muestra tras las acciones de Caja chica que
// redirigen con ?toast=<clave>. El registro comun los reune en
// src/modules/notification-registry.ts.
export const pettyCashNotifications = {
  "petty-cash-movement-annulled": { type: "warning", message: "Movimiento de caja anulado" },
  "petty-cash-income-registered": { type: "success", message: "Ingreso de caja registrado correctamente" },
  "petty-cash-expense-registered": { type: "success", message: "Egreso de caja registrado correctamente" },
  "petty-cash-box-created": { type: "success", message: "Caja chica creada correctamente" },
  "expense-category-created": { type: "success", message: "Categoría de gasto creada correctamente" },
  "expense-category-updated": { type: "success", message: "Categoría de gasto actualizada correctamente" },
  "expense-category-activated": { type: "success", message: "Categoría de gasto activada" },
  "expense-category-deactivated": { type: "warning", message: "Categoría de gasto desactivada" },
} satisfies NotificationCatalog;
