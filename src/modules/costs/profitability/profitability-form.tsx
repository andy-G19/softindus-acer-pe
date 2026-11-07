"use client";

import { useActionState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { useFormResult } from "@/components/forms/form-surface";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { ProfitabilityFormState } from "@/modules/costs/profitability/actions";

type ProfitabilityFormProps = {
  action: (prevState: ProfitabilityFormState, formData: FormData) => Promise<ProfitabilityFormState>;
  idCosteo: string;
  /** Aviso del catalogo de Costos; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

const initialState: ProfitabilityFormState = { status: "idle" };

// Calcular la rentabilidad en el detalle del costeo (B4 de la 10.8b, D4). Un rechazo del
// calculo (sin margen, costo o ingreso en cero) queda en la seccion con las observaciones
// escritas; con exito hay un solo aviso, las observaciones quedan vacias y la
// revalidacion repinta el historial.
export function ProfitabilityForm({ action, idCosteo, successNotification }: ProfitabilityFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const observaciones = state.status === "error" ? state.values.observaciones : "";
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

      <Field id="observaciones_rentabilidad" label="Observaciones" errors={fieldErrors?.observaciones}>
        {(control) => (
          <Textarea
            {...control}
            name="observaciones"
            rows={3}
            placeholder="Ejemplo: Rentabilidad aceptable según margen comercial aplicado."
            defaultValue={observaciones}
          />
        )}
      </Field>

      <SubmitButton pendingText="Calculando...">Calcular rentabilidad</SubmitButton>
    </ActionForm>
  );
}
