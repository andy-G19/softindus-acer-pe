"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  showError,
  showInfo,
  showSuccess,
  showWarning,
} from "@/lib/notifications";

type ToastDefinition = {
  type: "success" | "error" | "warning" | "info";
  message: string;
  description?: string;
};

const toastMessages: Record<string, ToastDefinition> = {
  "login-success": {
    type: "success",
    message: "Inicio de sesión exitoso",
    description: "Bienvenido al Sistema de Gestión Integral.",
  },

  // Comercial
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

  // Inventario
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

  // Mantenimiento
  "spare-part-created": { type: "success", message: "Repuesto guardado correctamente" },
  "spare-part-updated": { type: "success", message: "Repuesto actualizado correctamente" },
  "spare-part-activated": { type: "success", message: "Repuesto activado" },
  "spare-part-deactivated": { type: "warning", message: "Repuesto desactivado" },
  "machine-created": { type: "success", message: "Máquina guardada correctamente" },
  "machine-updated": { type: "success", message: "Máquina actualizada correctamente" },
  "machine-status-updated": { type: "success", message: "Estado de máquina actualizado" },
  "machine-activated": { type: "success", message: "Máquina activada" },
  "machine-deactivated": { type: "warning", message: "Máquina desactivada" },
  "failure-created": { type: "success", message: "Falla registrada correctamente" },
  "failure-updated": { type: "success", message: "Estado de falla actualizado" },
  "repair-created": { type: "success", message: "Reparación registrada correctamente" },
  "repair-updated": { type: "success", message: "Estado de reparación actualizado" },
  "preventive-maintenance-created": { type: "success", message: "Mantenimiento preventivo programado" },
  "preventive-maintenance-updated": { type: "success", message: "Estado de mantenimiento actualizado" },

  // Producción
  "campaign-created": { type: "success", message: "Campaña creada correctamente" },
  "campaign-detail-created": { type: "success", message: "Producto agregado a la campaña" },
  "campaign-updated": { type: "success", message: "Campaña actualizada correctamente" },
  "campaign-status-activa": { type: "success", message: "Campaña activada" },
  "campaign-status-finalizada": { type: "success", message: "Campaña finalizada" },
  "campaign-status-anulada": { type: "warning", message: "Campaña anulada" },
  "work-order-created": { type: "success", message: "Orden de trabajo creada correctamente" },
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

  // Costos
  "indirect-cost-created": { type: "success", message: "Costo indirecto agregado correctamente" },
  "indirect-cost-annulled": { type: "warning", message: "Costo indirecto anulado" },
  "costing-created": { type: "success", message: "Costeo creado correctamente" },
  "costing-updated": { type: "success", message: "Costeo actualizado correctamente" },
  "costing-recalculated": { type: "success", message: "Costeo recalculado correctamente" },
  "profitability-created": { type: "success", message: "Rentabilidad calculada correctamente" },
  "margin-created": { type: "success", message: "Margen aplicado correctamente" },

  // Personal
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

  // Usuarios
  "user-created": { type: "success", message: "Usuario creado correctamente" },
  "user-updated": { type: "success", message: "Usuario actualizado correctamente" },
  "user-activated": { type: "success", message: "Usuario activado" },
  "user-deactivated": { type: "warning", message: "Usuario desactivado" },
  "user-password-reset": { type: "success", message: "Contraseña reiniciada correctamente" },
  "user-self-deactivate-blocked": {
    type: "error",
    message: "No puedes desactivar tu propio usuario",
  },

  // Caja chica
  "petty-cash-movement-annulled": { type: "warning", message: "Movimiento de caja anulado" },
  "petty-cash-income-registered": { type: "success", message: "Ingreso de caja registrado correctamente" },
  "petty-cash-expense-registered": { type: "success", message: "Egreso de caja registrado correctamente" },
  "petty-cash-box-created": { type: "success", message: "Caja chica creada correctamente" },
  "expense-category-created": { type: "success", message: "Categoría de gasto creada correctamente" },
  "expense-category-updated": { type: "success", message: "Categoría de gasto actualizada correctamente" },
  "expense-category-activated": { type: "success", message: "Categoría de gasto activada" },
  "expense-category-deactivated": { type: "warning", message: "Categoría de gasto desactivada" },

  // Mermas y chatarra
  "scrap-sale-created": { type: "success", message: "Venta de chatarra registrada correctamente" },
  "scrap-created": { type: "success", message: "Chatarra registrada correctamente" },
  "reusable-scrap-created": { type: "success", message: "Retazo reutilizable creado correctamente" },
};

function showToastFromDefinition(definition: ToastDefinition) {
  if (definition.type === "success") {
    showSuccess(definition.message, definition.description);
    return;
  }

  if (definition.type === "error") {
    showError(definition.message, definition.description);
    return;
  }

  if (definition.type === "warning") {
    showWarning(definition.message, definition.description);
    return;
  }

  showInfo(definition.message, definition.description);
}

export function NotificationQueryBridge() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const displayedToastRef = useRef<string | null>(null);

  useEffect(() => {
    const toastKey = searchParams.get("toast");

    if (!toastKey || displayedToastRef.current === toastKey) {
      return;
    }

    displayedToastRef.current = toastKey;

    const definition = toastMessages[toastKey];

    if (definition) {
      showToastFromDefinition(definition);
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("toast");

    const nextUrl = nextParams.toString()
      ? `${pathname}?${nextParams.toString()}`
      : pathname;

    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}
