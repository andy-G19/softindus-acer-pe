import type { NotificationCatalog } from "@/lib/notification-catalog";

// Mensajes que el puente ?toast= muestra tras las acciones de Inventario que
// redirigen con ?toast=<clave>. El registro comun los reune en
// src/modules/notification-registry.ts.
export const inventoryNotifications = {
  "material-created": { type: "success", message: "Material guardado correctamente" },
  "material-updated": { type: "success", message: "Material actualizado correctamente" },
  "material-activated": { type: "success", message: "Material activado" },
  "material-deactivated": { type: "warning", message: "Material desactivado" },
  "supplier-created": { type: "success", message: "Proveedor guardado correctamente" },
  "supplier-updated": { type: "success", message: "Proveedor actualizado correctamente" },
  "supplier-activated": { type: "success", message: "Proveedor activado" },
  "supplier-deactivated": { type: "warning", message: "Proveedor desactivado" },
  "purchase-created": { type: "success", message: "Compra registrada correctamente" },
  "purchase-annulled": { type: "warning", message: "Compra anulada" },
  "inventory-movement-created": {
    type: "success",
    message: "Movimiento de inventario registrado",
    description: "Stock actualizado correctamente.",
  },
  "supplier-material-created": { type: "success", message: "Asociación proveedor-material creada" },
  "supplier-material-updated": { type: "success", message: "Asociación proveedor-material actualizada" },
  "supplier-material-activated": { type: "success", message: "Asociación proveedor-material activada" },
  "supplier-material-deactivated": { type: "warning", message: "Asociación proveedor-material desactivada" },
  "supplier-payment-registered": { type: "success", message: "Pago a proveedor registrado correctamente" },
  "supplier-type-activated": { type: "success", message: "Tipo de proveedor activado" },
  "supplier-type-deactivated": { type: "warning", message: "Tipo de proveedor desactivado" },
  "material-category-activated": { type: "success", message: "Categoría de material activada" },
  "material-category-deactivated": { type: "warning", message: "Categoría de material desactivada" },
  "stock-alert-attended": { type: "success", message: "Alerta de stock atendida" },
} satisfies NotificationCatalog;
