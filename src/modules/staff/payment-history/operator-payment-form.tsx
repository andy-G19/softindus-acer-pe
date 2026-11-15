"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, type MouseEvent } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { DiscardConfirmDialog, useDiscardGuard, useFormResult } from "@/components/forms/form-surface";
import { OperationKeyField } from "@/components/forms/operation-key-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { OperatorPaymentFormState } from "@/modules/staff/payment-history/actions";

/** Una planilla pendiente, con el texto que arma la pagina. */
export type PendingPayrollOption = { value: string; label: string };

const PAYMENT_METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "otro", label: "Otro" },
];

type OperatorPaymentFormProps = {
  action: (prevState: OperatorPaymentFormState, formData: FormData) => Promise<OperatorPaymentFormState>;
  payrolls: PendingPayrollOption[];
  /** Fecha que propone el campo (aaaa-mm-dd), calculada por la pagina. */
  defaultDate: string;
  /**
   * Aviso que se da al guardar, del catalogo de Personal. La pagina lo pasa con su clave literal
   * (staffNotifications["operator-payment-registered"]) para que notification-registry.test.ts
   * vea quien emite la clave.
   */
  successNotification: NotificationDefinition;
  /** Pagina a la que vuelve al guardar o cancelar; la pagina ya la valido. */
  returnTo: string;
};

const initialState: OperatorPaymentFormState = { status: "idle" };

const DISCARD = {
  title: "¿Descartar el pago?",
  description: "Se perderán los datos que escribiste en este formulario.",
};

// Formulario del pago de planilla (C7 de la 11.5, D59), como el de generar planilla (C6): con
// error, el mensaje general queda en el formulario y cada error va junto a su campo, con lo
// enviado; con exito hay un solo aviso, la clave se renueva y se vuelve al historial.
export function OperatorPaymentForm({
  action,
  payrolls,
  defaultDate,
  successNotification,
  returnTo,
}: OperatorPaymentFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;
  const completedKey = state.status === "success" ? state.data.clave_operacion : undefined;

  // Una planilla que ya no esta entre las opciones deja el campo sin elegir: con un valor que no
  // es una opcion, el navegador elegiria la primera habilitada, otra planilla (la leccion del
  // hallazgo 9 de la 11.4b).
  const requestedPayrollId = values?.id_planilla ?? "";
  const payrollId = payrolls.some((item) => item.value === requestedPayrollId) ? requestedPayrollId : "";

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
        <OperationKeyField scope="pago_planilla:nuevo" completedKey={completedKey} />

        {state.status === "error" ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Field
          id="id_planilla"
          label="Planilla pendiente"
          required
          description="Para esta versión, el monto pagado debe ser igual al monto neto de la planilla seleccionada."
          errors={fieldErrors?.id_planilla}
        >
          {(control) => (
            <NativeSelect {...control} name="id_planilla" defaultValue={payrollId}>
              <option value="" disabled>
                Seleccione una planilla
              </option>
              {payrolls.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <div className="grid gap-4 md:grid-cols-3">
          <Field id="fecha_pago" label="Fecha de pago" required errors={fieldErrors?.fecha_pago}>
            {(control) => (
              <Input {...control} name="fecha_pago" type="date" defaultValue={values?.fecha_pago ?? defaultDate} />
            )}
          </Field>

          <Field id="monto_pagado" label="Monto pagado" required errors={fieldErrors?.monto_pagado}>
            {(control) => (
              <Input
                {...control}
                name="monto_pagado"
                type="number"
                min="0"
                step="0.01"
                defaultValue={values?.monto_pagado ?? ""}
                placeholder="Ejemplo: 160.00"
              />
            )}
          </Field>

          <Field id="metodo_pago" label="Método de pago" required errors={fieldErrors?.metodo_pago}>
            {(control) => (
              <NativeSelect {...control} name="metodo_pago" defaultValue={values?.metodo_pago ?? "efectivo"}>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
        </div>

        <Field id="observaciones" label="Observaciones" errors={fieldErrors?.observaciones}>
          {(control) => (
            <Textarea
              {...control}
              name="observaciones"
              rows={4}
              defaultValue={values?.observaciones ?? ""}
              placeholder="Ejemplo: Pago entregado en efectivo al finalizar la semana."
            />
          )}
        </Field>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" asChild>
            <Link href={returnTo} onClick={handleCancel}>
              Cancelar
            </Link>
          </Button>
          <SubmitButton pendingText="Registrando...">Registrar pago</SubmitButton>
        </div>
      </ActionForm>

      <DiscardConfirmDialog {...discardDialog} {...DISCARD} />
    </>
  );
}
