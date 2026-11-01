"use client";

import { useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";

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
  /** Se ve y se anuncia deshabilitado e ignora el clic, pero conserva el foco. */
  disabled?: boolean;
  /**
   * Sin confirmacion, recibe el error en lugar de darlo como aviso; recibe null
   * al ejecutar la accion, para limpiar el anterior.
   */
  onError?: (error: string | null) => void;
};

const IDLE = { status: "idle" } as const;

/** Fila y tabla del boton, guardadas mientras esta en la pagina. */
type FocusAnchor = { row: HTMLElement | null; table: HTMLElement | null };

// Destino del foco cuando el boton ya no esta (hallazgo 13 de la 10.3a): su
// fila, si sigue en la pagina, o su tabla. Ninguna se enfoca por si sola, asi
// que recibe tabindex -1 (enfocable desde el script, fuera del orden de Tab)
// hasta que el foco sale de ella.
function fallbackFocusTarget(anchor: FocusAnchor) {
  const target = [anchor.row, anchor.table].find((element) => element?.isConnected) ?? null;

  if (target && !target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener("focusout", () => target.removeAttribute("tabindex"), { once: true });
  }

  return target;
}

// Accion de fila con confirmacion (entrega 10): inactivar, dar de baja, anular.
// La accion se ejecuta en startTransition y su pendiente es el de
// useTransition, que dura hasta que la accion responde: mientras tanto la
// confirmacion no se cancela ni se cierra con Esc. Con exito da un solo aviso
// y se cierra (la lista se actualiza por el revalidatePath de la accion); con
// error queda abierta y muestra el mensaje dentro. Sin confirm, el boton
// ejecuta la accion y un error sale como aviso.
//
// La lista se vuelve a pintar con los datos nuevos y el boton puede
// desaparecer: atender una alerta deja la fila sin la accion, e inactivar con
// el filtro «Activo» saca la fila. Entonces el foco va a la fila o a la tabla
// en lugar de quedar en body, con la confirmacion todavia abierta (al cerrarse)
// o despues (al desmontarse el boton enfocado). Si el boton sigue (Inactivar
// pasa a Activar), el foco se queda en el.
export function ConfirmActionButton<Values, Data>({
  action,
  fields,
  children,
  variant = "outline",
  size = "sm",
  successNotification,
  confirm,
  pendingText,
  disabled = false,
  onError,
}: ConfirmActionButtonProps<Values, Data>) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const anchorRef = useRef<FocusAnchor>({ row: null, table: null });

  // La fila (con key) y la tabla del boton no cambian mientras esta montado; el
  // boton tampoco: al pasar de Inactivar a Activar React conserva su nodo.
  // Al desmontarse, React todavia no saco el boton del documento: si tenia el
  // foco, en cuanto sale el foco quedaria en body, y se lleva a la fila o a la
  // tabla.
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    anchorRef.current = { row: trigger?.closest("tr") ?? null, table: trigger?.closest("table") ?? null };

    return () => {
      if (!trigger || document.activeElement !== trigger) {
        return;
      }

      const anchor = anchorRef.current;
      setTimeout(() => {
        if (!trigger.isConnected && (document.activeElement === null || document.activeElement === document.body)) {
          fallbackFocusTarget(anchor)?.focus();
        }
      }, 0);
    };
  }, []);

  // Al cerrarse la confirmacion: al boton si sigue; si no, a su fila o tabla.
  function returnFocusTo() {
    const trigger = triggerRef.current;

    return trigger?.isConnected ? trigger : fallbackFocusTarget(anchorRef.current);
  }

  function run() {
    const formData = new FormData();
    for (const [name, value] of Object.entries(fields)) {
      formData.set(name, value);
    }

    onError?.(null);

    startTransition(async () => {
      const result = await action(IDLE, formData);

      if (result.status === "success") {
        notify(successNotification);
        setError(null);
        setOpen(false);
      } else if (result.status === "error") {
        if (confirm) {
          setError(result.error);
        } else if (onError) {
          onError(result.error);
        } else {
          notify({ type: "error", message: result.error });
        }
      }
    });
  }

  function press() {
    if (disabled) {
      return;
    }

    if (confirm) {
      setOpen(true);
    } else {
      run();
    }
  }

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setError(null);
    }
  }

  // La misma estructura con o sin confirmacion: en RowStatusSelect la
  // confirmacion depende del estado elegido, y otra forma remontaria el boton.
  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant={variant}
        size={size}
        pending={confirm ? undefined : pending}
        pendingText={confirm ? undefined : pendingText}
        aria-disabled={disabled ? true : undefined}
        className={disabled ? "pointer-events-none opacity-50" : undefined}
        onClick={press}
      >
        {children}
      </Button>
      {confirm ? (
        <ConfirmDialog
          open={open}
          onOpenChange={changeOpen}
          closeOnConfirm={false}
          returnFocusTo={returnFocusTo}
          variant={confirm.variant ?? "destructive"}
          title={confirm.title}
          description={confirm.description}
          confirmText={confirm.confirmText}
          onConfirm={run}
          pending={pending}
          pendingText={pendingText}
          error={error}
        />
      ) : null}
    </>
  );
}
