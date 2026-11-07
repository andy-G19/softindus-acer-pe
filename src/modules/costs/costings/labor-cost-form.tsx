"use client";

import { useActionState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { useFormResult } from "@/components/forms/form-surface";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { LaborCostFormState } from "@/modules/costs/costings/actions";

type LaborCostFormProps = {
  action: (prevState: LaborCostFormState, formData: FormData) => Promise<LaborCostFormState>;
  idCosteo: string;
  /** La mano de obra guardada, con dos decimales. */
  defaultValue: string;
  /** Aviso del catalogo de Costos; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

const initialState: LaborCostFormState = { status: "idle" };

// Ajuste de la mano de obra en el detalle del costeo (B4 de la 10.8b, D4). El formulario
// sigue en su seccion: con error el mensaje queda aqui con lo escrito y el campo marcado;
// con exito hay un solo aviso, el campo conserva el monto y la revalidacion repinta el
// detalle con los totales nuevos.
export function LaborCostForm({ action, idCosteo, defaultValue, successNotification }: LaborCostFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const value = state.status === "idle" ? defaultValue : state.values.costo_mano_obra;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;

  useFormResult(state, pending, { successNotification });

  return (
    <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="mt-4 space-y-3">
      <input type="hidden" name="id_costeo" value={idCosteo} />

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Field id="costo_mano_obra" label="Costo de mano de obra" required errors={fieldErrors?.costo_mano_obra}>
          {(control) => (
            <Input {...control} name="costo_mano_obra" type="number" min="0" step="0.01" defaultValue={value} />
          )}
        </Field>

        <SubmitButton className="self-end" pendingText="Guardando...">
          Actualizar
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
