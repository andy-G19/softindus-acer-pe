import type { NotificationCatalog } from "@/lib/notification-catalog";

// Mensajes que el puente ?toast= muestra tras las acciones de Produccion que
// redirigen con ?toast=<clave>. El registro comun los reune en
// src/modules/notification-registry.ts.
export const productionNotifications = {
  "campaign-created": { type: "success", message: "Campaña creada correctamente" },
  "campaign-detail-created": { type: "success", message: "Producto agregado a la campaña" },
  "campaign-updated": { type: "success", message: "Campaña actualizada correctamente" },
  "campaign-status-activa": { type: "success", message: "Campaña activada" },
  "campaign-status-finalizada": { type: "success", message: "Campaña finalizada" },
  "campaign-status-anulada": { type: "warning", message: "Campaña anulada" },
  "work-order-created": { type: "success", message: "Orden de trabajo creada correctamente" },
  // Sin emisor desde 5599788: el consumo de materiales todo o nada se
  // reemplazo por la entrega, la devolucion y el cierre. Se conserva para no
  // cambiar lo que muestra una URL con esta clave; retirarla es un fix aparte.
  "work-order-materials-consumed": { type: "success", message: "Consumo de materiales registrado" },
  "work-order-annulled": { type: "warning", message: "Orden de trabajo anulada" },
  "work-order-finished": { type: "success", message: "Orden de trabajo finalizada" },
  "route-stage-created": { type: "success", message: "Etapa de ruta creada correctamente" },
  "route-stage-updated": { type: "success", message: "Etapa de ruta actualizada correctamente" },
  "route-stage-activated": { type: "success", message: "Etapa de ruta activada" },
  "route-stage-deactivated": { type: "warning", message: "Etapa de ruta desactivada" },
  "route-created": { type: "success", message: "Ruta de fabricación creada correctamente" },
  "route-updated": { type: "success", message: "Ruta de fabricación actualizada correctamente" },
  "route-activated": { type: "success", message: "Ruta de fabricación activada" },
  "route-deactivated": { type: "warning", message: "Ruta de fabricación desactivada" },
  "recipe-version-created": { type: "success", message: "Nueva versión de receta creada" },
  "recipe-version-set-current": { type: "success", message: "Versión de receta marcada como vigente" },
  "recipe-version-annulled": { type: "warning", message: "Versión de receta anulada" },
  "recipe-detail-created": { type: "success", message: "Material agregado a la receta" },
  "recipe-detail-updated": { type: "success", message: "Detalle de receta actualizado" },
  "recipe-detail-deleted": { type: "warning", message: "Material eliminado de la receta" },
  "recipe-created": { type: "success", message: "Receta técnica creada correctamente" },
  "recipe-activated": { type: "success", message: "Receta técnica activada" },
  "recipe-deactivated": { type: "warning", message: "Receta técnica desactivada" },
  "work-order-materials-delivered": { type: "success", message: "Materiales entregados a la orden" },
  "work-order-additional-delivery": { type: "success", message: "Entrega adicional registrada" },
  "work-order-material-returned": { type: "success", message: "Devolución registrada" },
  "work-order-materials-closed": { type: "success", message: "Materiales cerrados" },
  "work-order-materials-reopened": { type: "warning", message: "Cierre de materiales reabierto" },
  "work-order-progress-generated": { type: "success", message: "Avances de orden generados correctamente" },
  "work-order-progress-updated": { type: "success", message: "Avance de orden actualizado" },
  "work-order-progress-reassigned": { type: "success", message: "Tarea reasignada correctamente" },
} satisfies NotificationCatalog;
