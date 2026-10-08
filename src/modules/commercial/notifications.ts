import type { NotificationCatalog } from "@/lib/notification-catalog";

// Mensajes que el puente ?toast= muestra tras las acciones de Comercial que
// redirigen con ?toast=<clave>. El registro comun los reune en
// src/modules/notification-registry.ts.
export const commercialNotifications = {
  "client-created": { type: "success", message: "Cliente guardado correctamente" },
  "client-updated": { type: "success", message: "Cliente actualizado correctamente" },
  "client-activated": { type: "success", message: "Cliente activado" },
  "client-deactivated": { type: "warning", message: "Cliente desactivado" },
  "product-created": { type: "success", message: "Producto guardado correctamente" },
  "product-updated": { type: "success", message: "Producto actualizado correctamente" },
  "product-activated": { type: "success", message: "Producto activado" },
  "product-deactivated": { type: "warning", message: "Producto desactivado" },
  "product-category-activated": { type: "success", message: "Categoría de producto activada" },
  "product-category-deactivated": { type: "warning", message: "Categoría de producto desactivada" },
  "order-created": { type: "success", message: "Pedido creado correctamente" },
  "order-updated": { type: "success", message: "Pedido actualizado correctamente" },
  "order-cancelled": { type: "warning", message: "Pedido cancelado" },
  "quote-created": { type: "success", message: "Proforma creada correctamente" },
  "quote-annulled": { type: "warning", message: "Proforma anulada" },
  "receipt-created": { type: "success", message: "Comprobante registrado correctamente" },
  "receipt-annulled": { type: "warning", message: "Comprobante anulado" },
  "payment-registered": {
    type: "success",
    message: "Pago registrado correctamente",
    description: "El saldo fue actualizado.",
  },
} satisfies NotificationCatalog;
