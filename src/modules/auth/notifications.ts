import type { NotificationCatalog } from "@/lib/notification-catalog";

// Mensajes que el puente ?toast= muestra tras las acciones de Acceso que
// redirigen con ?toast=<clave>. El registro comun los reune en
// src/modules/notification-registry.ts.
export const authNotifications = {
  "login-success": {
    type: "success",
    message: "Inicio de sesión exitoso",
    description: "Bienvenido al Sistema de Gestión Integral.",
  },
} satisfies NotificationCatalog;
