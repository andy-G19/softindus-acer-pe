/**
 * Contrato del catalogo de notificaciones: que severidad y que texto muestra
 * cada mensaje.
 *
 * Solo tipos, sin "use client" y sin dependencias: los catalogos de cada area
 * son datos y no dependen de las librerias que los muestran. La fachada
 * (`lib/notifications.ts`) recibe una definicion y decide como presentarla;
 * cambiar de libreria no cambia ningun catalogo.
 */

export type NotificationSeverity = "success" | "error" | "warning" | "info";

export type NotificationDefinition = {
  type: NotificationSeverity;
  message: string;
  description?: string;
};

export type NotificationCatalog = Record<string, NotificationDefinition>;
