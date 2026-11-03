import type { NotificationCatalog } from "@/lib/notification-catalog";

// Avisos de Usuarios. Desde la 10.7b ninguna accion redirige con ?toast=: las
// pantallas los dan con el resultado de la accion y los pasan con su clave
// literal. El registro comun los reune en src/modules/notification-registry.ts.
export const usersNotifications = {
  "user-created": { type: "success", message: "Usuario creado correctamente" },
  "user-updated": { type: "success", message: "Usuario actualizado correctamente" },
  "user-activated": { type: "success", message: "Usuario activado" },
  "user-deactivated": { type: "warning", message: "Usuario desactivado" },
  "user-password-reset": { type: "success", message: "Contraseña reiniciada correctamente" },
} satisfies NotificationCatalog;
