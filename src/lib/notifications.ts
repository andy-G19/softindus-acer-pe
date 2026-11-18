"use client";

// Fachada de los avisos: solo Toastify. SweetAlert2 (showConfirm, showDeleteConfirm, showLoading
// y closeModal) se retiro en la 11.7a; las confirmaciones usan ConfirmDialog o
// ConfirmActionButton.
import { createElement } from "react";
import { toast, type ToastOptions } from "react-toastify";

import type {
  NotificationDefinition,
  NotificationSeverity,
} from "@/lib/notification-catalog";

const toastTypeClassNames: Record<NotificationSeverity, string> = {
  success: "toast-industrial-success",
  error: "toast-industrial-error",
  warning: "toast-industrial-warning",
  info: "toast-industrial-info",
};

function notificationContent(message: string, description?: string) {
  return createElement(
    "div",
    { className: "space-y-1" },
    createElement("p", { className: "text-sm font-semibold" }, message),
    description
      ? createElement(
          "p",
          { className: "text-xs leading-relaxed text-muted-foreground" },
          description,
        )
      : null,
  );
}

function showToast(
  type: NotificationSeverity,
  message: string,
  description?: string,
) {
  const options: ToastOptions = {
    className: toastTypeClassNames[type],
    progressClassName: `toast-industrial-progress-${type}`,
  };

  toast[type](notificationContent(message, description), options);
}

export function showSuccess(message: string, description?: string) {
  showToast("success", message, description);
}

export function showError(message: string, description?: string) {
  showToast("error", message, description);
}

export function showWarning(message: string, description?: string) {
  showToast("warning", message, description);
}

export function showInfo(message: string, description?: string) {
  showToast("info", message, description);
}

// Muestra una definicion del catalogo. Cualquier valor que no sea success,
// error o warning se muestra como info.
export function notify(definition: NotificationDefinition) {
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
