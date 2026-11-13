"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, type MouseEvent } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { DiscardConfirmDialog, useDiscardGuard, useFormResult } from "@/components/forms/form-surface";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { PettyCashBoxFormState } from "@/modules/petty-cash/boxes/actions";

type PettyCashBoxFormProps = {
  action: (prevState: PettyCashBoxFormState, formData: FormData) => Promise<PettyCashBoxFormState>;
  /** Fecha que propone el campo (aaaa-mm-dd), calculada por la pagina. */
  defaultDate: string;
  /**
   * Aviso que se da al guardar, del catalogo de Caja chica. La pagina lo pasa con su clave literal
   * (pettyCashNotifications["petty-cash-box-created"]) para que notification-registry.test.ts vea
   * quien emite la clave.
   */
  successNotification: NotificationDefinition;
  /** Pagina a la que vuelve al guardar o cancelar; la pagina ya la valido. */
  returnTo: string;
};

const initialState: PettyCashBoxFormState = { status: "idle" };

const DISCARD = {
  title: "¿Descartar la caja?",
  description: "Se perderán los datos que escribiste en este formulario.",
};

// Formulario para abrir una caja chica (C7 de la 11.4a, D46), como el del egreso (C5) pero sin
// clave de operacion: abrir una caja no mueve dinero de otra y un reenvio choca con el nombre
// repetido. Con error, el mensaje queda en el formulario y en su campo, con lo enviado; con exito
// hay un solo aviso y se vuelve al listado de cajas.
export function PettyCashBoxForm({ action, defaultDate, successNotification, returnTo }: PettyCashBoxFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;

  const goBack = useCallback(() => router.push(returnTo), [router, returnTo]);
  const { controls, markDirty, trackFocus, discardDialog } = useDiscardGuard({ onLeave: goBack });

  // Mientras la accion esta pendiente, Cancelar no sale.
  useEffect(() => {
    controls.setBusy(pending);
  }, [controls, pending]);

  // Un aviso por operacion; tras guardar vuelve sin preguntar.
  useFormResult(state, pending, { successNotification, onSuccess: controls.closeAfterSave });

  // Un clic normal en Cancelar pasa por el descarte; con una tecla de modificador o la rueda, el
  // enlace abre la pagina en otra pestana.
  function handleCancel(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    controls.requestClose();
  }

  return (
    <>
      <ActionForm
        action={formAction}
        pending={pending}
        resultKey={resultKey}
        className="space-y-4"
        onInput={() => markDirty(true)}
        onFocus={trackFocus}
      >
        {state.status === "error" ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Field id="nombre_caja" label="Nombre de la caja" required errors={fieldErrors?.nombre_caja}>
          {(control) => (
            <Input
              {...control}
              name="nombre_caja"
              type="text"
              defaultValue={values?.nombre_caja ?? ""}
              placeholder="Ejemplo: Caja chica principal"
            />
          )}
        </Field>

        <Field id="saldo_inicial" label="Saldo inicial" required errors={fieldErrors?.saldo_inicial}>
          {(control) => (
            <Input
              {...control}
              name="saldo_inicial"
              type="number"
              min="0"
              step="0.01"
              defaultValue={values?.saldo_inicial ?? ""}
              placeholder="Ejemplo: 200.00"
            />
          )}
        </Field>

        <Field id="fecha_apertura" label="Fecha de apertura" required errors={fieldErrors?.fecha_apertura}>
          {(control) => (
            <Input
              {...control}
              name="fecha_apertura"
              type="date"
              defaultValue={values?.fecha_apertura ?? defaultDate}
            />
          )}
        </Field>

        <Field id="responsable" label="Responsable" errors={fieldErrors?.responsable}>
          {(control) => (
            <Input
              {...control}
              name="responsable"
              type="text"
              defaultValue={values?.responsable ?? ""}
              placeholder="Ejemplo: Administrador"
            />
          )}
        </Field>

        <Field id="observaciones" label="Observaciones" errors={fieldErrors?.observaciones}>
          {(control) => (
            <Textarea
              {...control}
              name="observaciones"
              rows={4}
              defaultValue={values?.observaciones ?? ""}
              placeholder="Observaciones sobre la apertura de caja."
            />
          )}
        </Field>

        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton pendingText="Abriendo...">Abrir caja chica</SubmitButton>

          <Button variant="outline" asChild>
            <Link href={returnTo} onClick={handleCancel}>
              Cancelar
            </Link>
          </Button>
        </div>
      </ActionForm>

      <DiscardConfirmDialog {...discardDialog} {...DISCARD} />
    </>
  );
}
