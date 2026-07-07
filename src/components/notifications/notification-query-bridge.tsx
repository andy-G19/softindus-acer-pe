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
  "client-created": {
    type: "success",
    message: "Cliente guardado correctamente",
  },
  "client-updated": {
    type: "success",
    message: "Cliente actualizado correctamente",
  },
  "client-deleted": {
    type: "success",
    message: "Cliente eliminado correctamente",
  },
  "product-created": {
    type: "success",
    message: "Producto guardado correctamente",
  },
  "product-updated": {
    type: "success",
    message: "Producto actualizado correctamente",
  },
  "product-deleted": {
    type: "success",
    message: "Producto eliminado correctamente",
  },
  "invoice-created": {
    type: "success",
    message: "Factura creada exitosamente",
  },
  "payment-registered": {
    type: "success",
    message: "Pago registrado correctamente",
    description: "El saldo fue actualizado.",
  },
  "inventory-movement-created": {
    type: "success",
    message: "Movimiento de inventario registrado",
    description: "Stock actualizado correctamente.",
  },
  "stock-critical": {
    type: "warning",
    message: "Atención: stock crítico detectado",
  },
  "data-updated": {
    type: "info",
    message: "Datos actualizados",
    description: "Mostrando información según los permisos de su rol.",
  },
  "operation-error": {
    type: "error",
    message: "No se pudo completar la operación",
    description: "Revise los datos ingresados e inténtelo nuevamente.",
  },
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
