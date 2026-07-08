"use client";

import type { MouseEvent, ReactNode } from "react";

import { showConfirm, showDeleteConfirm } from "@/lib/notifications";
import { cn } from "@/lib/utils";

type ConfirmDeleteButtonProps = {
  children: ReactNode;
  entityName?: string;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
};

export function ConfirmDeleteButton({
  children,
  entityName,
  title,
  description,
  confirmText,
  cancelText,
  onConfirm,
  disabled = false,
  className,
}: ConfirmDeleteButtonProps) {
  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();

    if (disabled) {
      return;
    }

    const form = event.currentTarget.form;

    const confirmed =
      title || description || confirmText || cancelText
        ? await showConfirm({
            title,
            text: description,
            confirmText,
            cancelText,
            icon: "warning",
            destructive: true,
          })
        : await showDeleteConfirm(entityName);

    if (!confirmed) {
      return;
    }

    if (onConfirm) {
      await onConfirm();
      return;
    }

    form?.requestSubmit();
  }

  return (
    <button
      type="submit"
      disabled={disabled}
      className={cn(
        "rounded-md border border-destructive/35 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:border-destructive/55 hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}
