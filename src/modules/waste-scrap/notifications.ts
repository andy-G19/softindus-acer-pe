import type { NotificationCatalog } from "@/lib/notification-catalog";

// Mensajes que el puente ?toast= muestra tras las acciones de Mermas y chatarra que
// redirigen con ?toast=<clave>. El registro comun los reune en
// src/modules/notification-registry.ts.
export const wasteScrapNotifications = {
  "scrap-sale-created": { type: "success", message: "Venta de chatarra registrada correctamente" },
  "scrap-created": { type: "success", message: "Chatarra registrada correctamente" },
  "reusable-scrap-created": { type: "success", message: "Retazo reutilizable creado correctamente" },
} satisfies NotificationCatalog;
