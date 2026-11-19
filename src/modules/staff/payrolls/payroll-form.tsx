"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState, type MouseEvent } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field, FieldError } from "@/components/forms/field";
import { DiscardConfirmDialog, useDiscardGuard, useFormResult } from "@/components/forms/form-surface";
import { OperationKeyField } from "@/components/forms/operation-key-field";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { PayrollFormState } from "@/modules/staff/payrolls/actions";

/** Un operario activo, con el texto que arma la pagina. */
export type PayrollOperatorOption = { id: string; label: string; description?: string };

type PayrollFormProps = {
  action: (prevState: PayrollFormState, formData: FormData) => Promise<PayrollFormState>;
  operators: PayrollOperatorOption[];
  /** Periodo que propone el formulario (aaaa-mm-dd), calculado por la pagina. */
  defaultStartDate: string;
  defaultEndDate: string;
  /**
   * Aviso que se da al guardar, del catalogo de Personal. La pagina lo pasa con su clave literal
   * (staffNotifications["payroll-created"]) para que notification-registry.test.ts vea quien
   * emite la clave.
   */
  successNotification: NotificationDefinition;
  /** Pagina a la que vuelve al guardar o cancelar; la pagina ya la valido. */
  returnTo: string;
};

const initialState: PayrollFormState = { status: "idle" };

const DISCARD = {
  title: "¿Descartar la planilla?",
  description: "Se perderán los datos que escribiste en este formulario.",
};

// Formulario de generar planilla (C6 de la 11.5, D59), como el de la venta de chatarra (C4 de la
// 11.4b): con error, el mensaje general queda en el formulario y cada error va junto a su campo,
// con lo enviado; con exito hay un solo aviso, la clave se renueva y se vuelve al listado.
export function PayrollForm({
  action,
  operators,
  defaultStartDate,
  defaultEndDate,
  successNotification,
  returnTo,
}: PayrollFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;
  const completedKey = state.status === "success" ? state.data.clave_operacion : undefined;

  // El operario elegido vive aqui y no en el campo: ActionForm vuelve a montar los campos con la
  // respuesta y SearchableSelect no tiene valor inicial propio, asi que tras un error se conserva.
  const [operatorId, setOperatorId] = useState("");

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

  const operatorErrors = fieldErrors?.id_operario;

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
        <OperationKeyField scope="planilla:nueva" completedKey={completedKey} />

        <FormErrorAlert state={state} />

        <div className="space-y-2">
          <SearchableSelect
            id="id_operario"
            name="id_operario"
            label="Operario"
            placeholder="Buscar operario..."
            items={operators}
            value={operatorId}
            onValueChange={setOperatorId}
            required
            emptyMessage="No hay operarios activos disponibles."
            {...(operatorErrors?.length
              ? { "aria-invalid": true as const, "aria-describedby": "id_operario-error" }
              : {})}
          />
          <FieldError id="id_operario-error" messages={operatorErrors} />

          <p className="text-xs text-muted-foreground">
            La tarifa se multiplicará por las asistencias válidas del periodo seleccionado.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field id="periodo_inicio" label="Inicio del periodo" required errors={fieldErrors?.periodo_inicio}>
            {(control) => (
              <Input
                {...control}
                name="periodo_inicio"
                type="date"
                defaultValue={values?.periodo_inicio ?? defaultStartDate}
              />
            )}
          </Field>

          <Field id="periodo_fin" label="Fin del periodo" required errors={fieldErrors?.periodo_fin}>
            {(control) => (
              <Input {...control} name="periodo_fin" type="date" defaultValue={values?.periodo_fin ?? defaultEndDate} />
            )}
          </Field>

          <Field id="descuentos" label="Descuentos" errors={fieldErrors?.descuentos}>
            {(control) => (
              <Input
                {...control}
                name="descuentos"
                type="number"
                min="0"
                step="0.01"
                defaultValue={values?.descuentos ?? "0"}
                placeholder="Ejemplo: 10.00"
              />
            )}
          </Field>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" asChild>
            <Link href={returnTo} onClick={handleCancel}>
              Cancelar
            </Link>
          </Button>
          <SubmitButton pendingText="Generando...">Generar planilla</SubmitButton>
        </div>
      </ActionForm>

      <DiscardConfirmDialog {...discardDialog} {...DISCARD} />
    </>
  );
}
