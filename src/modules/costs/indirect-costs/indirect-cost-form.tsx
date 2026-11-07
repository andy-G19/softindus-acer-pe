"use client";

import { useActionState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { useFormResult } from "@/components/forms/form-surface";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { IndirectCostFormState, IndirectCostFormValues } from "@/modules/costs/indirect-costs/actions";

type IndirectCostFormProps = {
  action: (prevState: IndirectCostFormState, formData: FormData) => Promise<IndirectCostFormState>;
  idCosteo: string;
  /** Aviso del catalogo de Costos; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

const initialState: IndirectCostFormState = { status: "idle" };

const EMPTY_VALUES: IndirectCostFormValues = {
  concepto: "",
  categoria: "luz",
  monto: "",
  criterio_prorrateo: "",
  periodo: "",
  observaciones: "",
};

const CATEGORIES = [
  ["luz", "Luz"],
  ["desgaste_maquinaria", "Desgaste de maquinaria"],
  ["transporte", "Transporte"],
  ["mantenimiento", "Mantenimiento"],
  ["alquiler", "Alquiler"],
  ["mano_obra_indirecta", "Mano de obra indirecta"],
  ["otros", "Otros"],
] as const;

// Registro de un costo indirecto en el detalle del costeo (B4 de la 10.8b, D4). Con error
// el mensaje queda en la seccion con lo escrito y el campo marcado; con exito hay un solo
// aviso, el formulario vuelve a quedar vacio para el siguiente y la revalidacion repinta
// el historial y los totales.
export function IndirectCostForm({ action, idCosteo, successNotification }: IndirectCostFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const values = state.status === "error" ? state.values : EMPTY_VALUES;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;

  useFormResult(state, pending, { successNotification });

  return (
    <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="space-y-4">
      <input type="hidden" name="id_costeo" value={idCosteo} />

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Field id="concepto" label="Concepto" required errors={fieldErrors?.concepto}>
        {(control) => (
          <Input
            {...control}
            name="concepto"
            maxLength={100}
            placeholder="Ejemplo: Consumo de luz del lote"
            defaultValue={values.concepto}
          />
        )}
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="categoria" label="Categoría" required errors={fieldErrors?.categoria}>
          {(control) => (
            <NativeSelect {...control} name="categoria" defaultValue={values.categoria}>
              {CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field id="monto" label="Monto" required errors={fieldErrors?.monto}>
          {(control) => (
            <Input
              {...control}
              name="monto"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              defaultValue={values.monto}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="criterio_prorrateo" label="Criterio de prorrateo" errors={fieldErrors?.criterio_prorrateo}>
          {(control) => (
            <Input
              {...control}
              name="criterio_prorrateo"
              maxLength={100}
              placeholder="Ejemplo: Prorrateado por lote"
              defaultValue={values.criterio_prorrateo}
            />
          )}
        </Field>

        <Field id="periodo" label="Periodo" errors={fieldErrors?.periodo}>
          {(control) => (
            <Input
              {...control}
              name="periodo"
              maxLength={30}
              placeholder="Ejemplo: 2026-06"
              defaultValue={values.periodo}
            />
          )}
        </Field>
      </div>

      <Field id="observaciones" label="Observaciones" errors={fieldErrors?.observaciones}>
        {(control) => (
          <Textarea
            {...control}
            name="observaciones"
            rows={3}
            placeholder="Detalle adicional del costo indirecto registrado."
            defaultValue={values.observaciones}
          />
        )}
      </Field>

      <SubmitButton pendingText="Guardando...">Registrar costo indirecto</SubmitButton>
    </ActionForm>
  );
}
