"use client";

import { createElement } from "react";
import Swal, { type SweetAlertIcon } from "sweetalert2";
import { toast, type ToastOptions } from "react-toastify";

type NotificationType = "success" | "error" | "warning" | "info";

type ConfirmOptions = {
  title?: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: SweetAlertIcon;
  destructive?: boolean;
};

const toastTypeClassNames: Record<NotificationType, string> = {
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
  type: NotificationType,
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

export async function showConfirm(options: ConfirmOptions = {}) {
  const result = await Swal.fire({
    title: options.title ?? "Esta acción requiere confirmación",
    text: options.text ?? "Verifique la información antes de continuar.",
    icon: options.icon ?? "warning",
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Confirmar",
    cancelButtonText: options.cancelText ?? "Cancelar",
    reverseButtons: true,
    focusCancel: true,
    buttonsStyling: false,
    customClass: {
      popup: "swal2-industrial-popup",
      title: "swal2-industrial-title",
      htmlContainer: "swal2-industrial-html",
      confirmButton: options.destructive
        ? "swal2-industrial-confirm swal2-industrial-confirm-destructive"
        : "swal2-industrial-confirm",
      cancelButton: "swal2-industrial-cancel",
      icon: "swal2-industrial-icon",
    },
  });

  return result.isConfirmed;
}

export function showDeleteConfirm(entityName = "registro") {
  return showConfirm({
    title: "¿Eliminar registro?",
    text: `Esta acción no se puede deshacer. Verifique antes de eliminar ${entityName}.`,
    confirmText: "Confirmar eliminación",
    cancelText: "Cancelar",
    icon: "warning",
    destructive: true,
  });
}

export function showLoading(
  title = "Procesando solicitud",
  text = "Espere un momento mientras se completa la operación.",
) {
  void Swal.fire({
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    },
    customClass: {
      popup: "swal2-industrial-popup",
      title: "swal2-industrial-title",
      htmlContainer: "swal2-industrial-html",
    },
  });
}

export function closeModal() {
  Swal.close();
}
