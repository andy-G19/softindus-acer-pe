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
import { formatMoney } from "@/lib/formatters";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { PettyCashIncomeAdjustmentFormState } from "@/modules/petty-cash/income-adjustments/actions";

export type IncomeAdjustmentCashBoxOption = {
  id_caja_chica: string;
  nombre_caja: string;
  saldo_actual: string;
};

type PettyCashIncomeAdjustmentFormProps = {
  action: (
    prevState: PettyCashIncomeAdjustmentFormState,
    formData: FormData,
  ) => Promise<PettyCashIncomeAdjustmentFormState>;
  boxes: IncomeAdjustmentCashBoxOption[];
  /** Fecha que propone el campo (aaaa-mm-dd), calculada por la pagina. */
  defaultDate: string;
  /**
   * Aviso que se da al guardar, del catalogo de Caja chica. La pagina lo pasa con su clave literal
   * (pettyCashNotifications["petty-cash-income-registered"]) para que
   * notification-registry.test.ts vea quien emite la clave.
   */
  successNotification: NotificationDefinition;
  /** Pagina a la que vuelve al guardar o cancelar; la pagina ya la valido. */
  returnTo: string;
};

const initialState: PettyCashIncomeAdjustmentFormState = { status: "idle" };

const DISCARD = {
  title: "¿Descartar el movimiento?",
  description: "Se perderán los datos que escribiste en este formulario.",
};

// Formulario del ingreso menor o ajuste de caja chica (C6 de la 11.4a, D46), como el del egreso
// (C5): con error, el mensaje general queda en el formulario y cada error va junto a su campo, con
// lo enviado; con exito hay un solo aviso, la clave se renueva y se vuelve a caja chica.
export function PettyCashIncomeAdjustmentForm({
  action,
  boxes,
  defaultDate,
  successNotification,
  returnTo,
}: PettyCashIncomeAdjustmentFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;
  const completedKey = state.status === "success" ? state.data.clave_operacion : undefined;

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
        <OperationKeyField scope="movimiento_caja:nuevo" completedKey={completedKey} />

        {state.status === "error" ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Field id="id_caja_chica" label="Caja chica" required errors={fieldErrors?.id_caja_chica}>
          {(control) => (
            <NativeSelect {...control} name="id_caja_chica" defaultValue={values?.id_caja_chica ?? ""}>
              <option value="">Selecciona una caja</option>
              {boxes.map((box) => (
                <option key={box.id_caja_chica} value={box.id_caja_chica}>
                  {box.nombre_caja} · Saldo: {formatMoney(box.saldo_actual)}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field id="tipo_operacion" label="Tipo de operación" required errors={fieldErrors?.tipo_operacion}>
          {(control) => (
            <NativeSelect {...control} name="tipo_operacion" defaultValue={values?.tipo_operacion ?? "ingreso"}>
              <option value="ingreso">Ingreso menor — aumenta saldo</option>
              <option value="ajuste_incremento">Ajuste positivo — aumenta saldo</option>
              <option value="ajuste_disminucion">Ajuste negativo — disminuye saldo</option>
            </NativeSelect>
          )}
        </Field>

        <Field id="concepto" label="Concepto" required errors={fieldErrors?.concepto}>
          {(control) => (
            <Input
              {...control}
              name="concepto"
              type="text"
              defaultValue={values?.concepto ?? ""}
              placeholder="Ejemplo: Devolución de vuelto no usado"
            />
          )}
        </Field>

        <Field id="monto" label="Monto" required errors={fieldErrors?.monto}>
          {(control) => (
            <Input
              {...control}
              name="monto"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={values?.monto ?? ""}
              placeholder="Ejemplo: 20.00"
            />
          )}
        </Field>

        <Field id="fecha_movimiento" label="Fecha del movimiento" required errors={fieldErrors?.fecha_movimiento}>
          {(control) => (
            <Input
              {...control}
              name="fecha_movimiento"
              type="date"
              defaultValue={values?.fecha_movimiento ?? defaultDate}
            />
          )}
        </Field>

        <Field id="comprobante" label="Comprobante o referencia" errors={fieldErrors?.comprobante}>
          {(control) => (
            <Input
              {...control}
              name="comprobante"
              type="text"
              defaultValue={values?.comprobante ?? ""}
              placeholder="Ejemplo: Ref. interna AJ-001"
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
              placeholder="Detalle adicional del ingreso o ajuste."
            />
          )}
        </Field>

        <div className="flex items-center gap-3">
          <SubmitButton pendingText="Registrando...">Registrar movimiento</SubmitButton>

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
