"use client";

import { useState, useTransition, type ReactNode } from "react";

import { ConfirmDialog } from "@/components/notifications/confirm-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { FormActionState } from "@/lib/action-result";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import { notify } from "@/lib/notifications";

type RowAction<Values, Data> = (
  prevState: FormActionState<Values, Data>,
  formData: FormData,
) => Promise<FormActionState<Values, Data>>;

type ConfirmActionButtonProps<Values, Data> = {
  /** Server Action con resultado (FormActionState); recibe los campos como FormData. */
  action: RowAction<Values, Data>;
  /** Campos que se envian: el id del registro y, al activar o inactivar, el estado pedido. */
  fields: Record<string, string>;
  /** Texto del boton ("Inactivar"). */
  children: ReactNode;
  variant?: ButtonProps["variant"];
  /** Sin tamanos de icono: el boton siempre lleva texto. */
  size?: "default" | "xs" | "sm" | "lg";
  /** Aviso del catalogo del area al terminar bien; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
  /**
   * Confirmacion con la entidad, la consecuencia y el verbo. Sin ella la accion
   * se ejecuta al pulsar: activar no es destructivo.
   */
  confirm?: {
    title: string;
    description: ReactNode;
    confirmText: string;
    variant?: "default" | "destructive";
  };
  pendingText?: string;
};

const IDLE = { status: "idle" } as const;

// Accion de fila con confirmacion (entrega 10): inactivar, dar de baja, anular.
// La accion se ejecuta en startTransition y su pendiente es el de
// useTransition, que dura hasta que la accion responde: mientras tanto la
// confirmacion no se cancela ni se cierra con Esc. Con exito da un solo aviso
// y se cierra (la lista se actualiza por el revalidatePath de la accion); con
// error queda abierta y muestra el mensaje dentro. Sin confirm, el boton
// ejecuta la accion y un error sale como aviso.
export function ConfirmActionButton<Values, Data>({
  action,
  fields,
  children,
  variant = "outline",
  size = "sm",
  successNotification,
  confirm,
  pendingText,
}: ConfirmActionButtonProps<Values, Data>) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    const formData = new FormData();
    for (const [name, value] of Object.entries(fields)) {
      formData.set(name, value);
    }

    startTransition(async () => {
      const result = await action(IDLE, formData);

      if (result.status === "success") {
        notify(successNotification);
        setError(null);
        setOpen(false);
      } else if (result.status === "error") {
        if (confirm) {
          setError(result.error);
        } else {
          notify({ type: "error", message: result.error });
        }
      }
    });
  }

  if (!confirm) {
    return (
      <Button type="button" variant={variant} size={size} pending={pending} pendingText={pendingText} onClick={run}>
        {children}
      </Button>
    );
  }

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setError(null);
    }
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={changeOpen}
        closeOnConfirm={false}
        variant={confirm.variant ?? "destructive"}
        title={confirm.title}
        description={confirm.description}
        confirmText={confirm.confirmText}
        onConfirm={run}
        pending={pending}
        pendingText={pendingText}
        error={error}
      />
    </>
  );
}
