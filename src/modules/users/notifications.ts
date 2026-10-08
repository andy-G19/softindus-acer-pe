import type { NotificationCatalog } from "@/lib/notification-catalog";

// Mensajes que el puente ?toast= muestra tras las acciones de Usuarios que
// redirigen con ?toast=<clave>. El registro comun los reune en
// src/modules/notification-registry.ts.
export const usersNotifications = {
  "user-created": { type: "success", message: "Usuario creado correctamente" },
  "user-updated": { type: "success", message: "Usuario actualizado correctamente" },
  "user-activated": { type: "success", message: "Usuario activado" },
  "user-deactivated": { type: "warning", message: "Usuario desactivado" },
  "user-password-reset": { type: "success", message: "Contraseña reiniciada correctamente" },
  "user-self-deactivate-blocked": {
    type: "error",
    message: "No puedes desactivar tu propio usuario",
  },
} satisfies NotificationCatalog;
