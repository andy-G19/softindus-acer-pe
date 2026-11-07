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
import type { MarginFormState, MarginFormValues } from "@/modules/costs/margins/actions";

type MarginFormProps = {
  action: (prevState: MarginFormState, formData: FormData) => Promise<MarginFormState>;
  idCosteo: string;
  /** Aviso del catalogo de Costos; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

const initialState: MarginFormState = { status: "idle" };

const EMPTY_VALUES: MarginFormValues = { porcentaje_margen: "15", precio_final: "", motivo_ajuste: "" };

const PERCENTAGES = ["15", "16", "17", "18", "19", "20"] as const;

// Aplicar un margen en el detalle del costeo (B4 de la 10.8b, D4). Con error el mensaje
// queda en la seccion con lo escrito y el campo marcado (el precio final bajo el costo
// marca el precio); con exito hay un solo aviso, el formulario vuelve al 15 % sin precio
// final y la revalidacion repinta el historial.
export function MarginForm({ action, idCosteo, successNotification }: MarginFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const values = state.status === "error" ? state.values : EMPTY_VALUES;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;

  useFormResult(state, pending, { successNotification });

  return (
    <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="mt-5 space-y-4">
      <input type="hidden" name="id_costeo" value={idCosteo} />

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Field id="porcentaje_margen" label="Margen de ganancia" required errors={fieldErrors?.porcentaje_margen}>
        {(control) => (
          <NativeSelect {...control} name="porcentaje_margen" defaultValue={values.porcentaje_margen}>
            {PERCENTAGES.map((percentage) => (
              <option key={percentage} value={percentage}>
                {percentage}%
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field
        id="precio_final"
        label="Precio final ajustado"
        description="Usa este campo si el administrador decide ajustar manualmente el precio por negociación, redondeo o estrategia comercial."
        errors={fieldErrors?.precio_final}
      >
        {(control) => (
          <Input
            {...control}
            name="precio_final"
            type="number"
            min="0"
            step="0.01"
            placeholder="Opcional. Si lo dejas vacío, se usará el precio sugerido."
            defaultValue={values.precio_final}
          />
        )}
      </Field>

      <Field id="motivo_ajuste" label="Motivo de ajuste" errors={fieldErrors?.motivo_ajuste}>
        {(control) => (
          <Textarea
            {...control}
            name="motivo_ajuste"
            rows={3}
            placeholder="Ejemplo: Se redondea el precio final por negociación con el cliente."
            defaultValue={values.motivo_ajuste}
          />
        )}
      </Field>

      <SubmitButton pendingText="Aplicando...">Aplicar margen</SubmitButton>
    </ActionForm>
  );
}
