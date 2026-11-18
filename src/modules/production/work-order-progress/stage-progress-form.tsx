"use client";

import { useActionState, type ReactNode } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { useFormResult } from "@/components/forms/form-surface";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { StageProgressFormState } from "@/modules/production/work-order-progress/actions";

type StageProgressFormProps = {
  idAvance: string;
  /** Lo guardado: el estado de la etapa y el porcentaje que la página propone para él. */
  estadoEtapa: string;
  porcentajeAvance: number;
  observaciones: string | null;
  /** La orden está anulada o finalizada: la tarjeta se muestra, pero no se puede guardar. */
  disabled: boolean;
  /** Partes que arma la página en el servidor: título, operario, fechas e historial. */
  header: ReactNode;
  operator: ReactNode;
  details: ReactNode;
  history: ReactNode;
  action: (prevState: StageProgressFormState, formData: FormData) => Promise<StageProgressFormState>;
  /**
   * Aviso al guardar, del catálogo de Producción. La página lo pasa con su clave literal para que
   * notification-registry.test.ts vea quién emite cada clave.
   */
  successNotification: NotificationDefinition;
};

const initialState: StageProgressFormState = { status: "idle" };

// C4 de la 11.6c (D81): cada etapa es su propio formulario con resultado. El error queda en su
// campo con lo escrito y el éxito da un aviso; la página se repinta con la revalidación. Terminar
// la última etapa finaliza la orden y el repintado llega deshabilitado en la misma respuesta: la
// tarjeta sigue montada (solo cambia disabled), así su aviso sale (hallazgo 9 de la 11.2a). Los ids
// llevan el avance: una página tiene una tarjeta por etapa y cada etiqueta apunta a su campo.
export function StageProgressForm({
  idAvance,
  estadoEtapa,
  porcentajeAvance,
  observaciones,
  disabled,
  header,
  operator,
  details,
  history,
  action,
  successNotification,
}: StageProgressFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  // Con éxito los campos toman lo guardado que trae el repintado: solo un error devuelve lo enviado.
  const values = state.status === "error" ? state.values : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;

  useFormResult(state, pending, { successNotification });

  return (
    <ActionForm
      action={formAction}
      pending={pending}
      resultKey={resultKey}
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <input type="hidden" name="id_avance" value={idAvance} />

      {header}

      <FormErrorAlert state={state} className="mt-4" />

      <div className="mt-5 grid gap-5 md:grid-cols-4">
        <Field
          id={`estado_etapa_${idAvance}`}
          label="Estado"
          required
          disabled={disabled}
          errors={fieldErrors?.estado_etapa}
        >
          {(control) => (
            <NativeSelect {...control} name="estado_etapa" defaultValue={values?.estado_etapa ?? estadoEtapa}>
              <option value="pendiente">Pendiente</option>
              <option value="en_proceso">En proceso</option>
              <option value="pausada">Pausada</option>
              <option value="terminada">Terminada</option>
            </NativeSelect>
          )}
        </Field>

        <Field
          id={`porcentaje_avance_${idAvance}`}
          label="Porcentaje"
          required
          disabled={disabled}
          errors={fieldErrors?.porcentaje_avance}
          description="Pendiente se guarda como 0%. Terminada se guarda como 100%."
        >
          {(control) => (
            <Input
              {...control}
              name="porcentaje_avance"
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue={values?.porcentaje_avance ?? porcentajeAvance}
            />
          )}
        </Field>

        <div className="space-y-2 md:col-span-2">{operator}</div>
      </div>

      {details}

      <Field
        id={`observaciones_${idAvance}`}
        label="Observaciones"
        disabled={disabled}
        errors={fieldErrors?.observaciones}
        className="mt-5"
      >
        {(control) => (
          <Textarea
            {...control}
            name="observaciones"
            rows={3}
            maxLength={700}
            defaultValue={values?.observaciones ?? observaciones ?? ""}
            placeholder="Ej. Etapa pausada por falta de material o máquina ocupada."
          />
        )}
      </Field>

      <div className="mt-5 flex justify-end">
        <SubmitButton disabled={disabled} pendingText="Actualizando...">
          Actualizar etapa
        </SubmitButton>
      </div>

      {history}
    </ActionForm>
  );
}
