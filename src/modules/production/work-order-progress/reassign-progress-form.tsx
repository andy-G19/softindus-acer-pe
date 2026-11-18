"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  type ComponentProps,
  type MouseEvent,
} from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field, FieldError } from "@/components/forms/field";
import { DiscardConfirmDialog, useDiscardGuard, useFormResult } from "@/components/forms/form-surface";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { ReassignProgressFormState } from "@/modules/production/work-order-progress/actions";

type ReassignProgressFormProps = {
  idAvance: string;
  /** Operarios activos a los que se puede reasignar: todos menos el actual. */
  operators: ComponentProps<typeof SearchableSelect>["items"];
  /** La orden está finalizada o anulada, o no hay operarios disponibles. */
  disabled: boolean;
  /** Los avances de la orden: adonde se vuelve al guardar o al cancelar. */
  progressHref: string;
  action: (prevState: ReassignProgressFormState, formData: FormData) => Promise<ReassignProgressFormState>;
  /**
   * Aviso al guardar, del catálogo de Producción. La página lo pasa con su clave literal para que
   * notification-registry.test.ts vea quién emite cada clave.
   */
  successNotification: NotificationDefinition;
};

const initialState: ReassignProgressFormState = { status: "idle" };

const DISCARD = {
  title: "¿Descartar la reasignación?",
  description: "Se perderán el operario elegido y el motivo que escribiste.",
};

const OPERATOR_FIELD = "id_operario_nuevo";

// C5 de la 11.6c (D82): reasignar usa la acción con resultado, como crear una orden (C5 de la
// 11.6a): con error, el mensaje general queda en el formulario y el del operario junto a su campo,
// con lo elegido; con éxito hay un solo aviso y se vuelve a los avances de la orden. La página solo
// se abre desde esos avances, así que vuelve siempre ahí.
export function ReassignProgressForm({
  idAvance,
  operators,
  disabled,
  progressHref,
  action,
  successNotification,
}: ReassignProgressFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;
  const operatorErrors = fieldErrors?.[OPERATOR_FIELD];

  // Lo elegido vive aquí y no en el campo: ActionForm vuelve a montar los campos con la respuesta y
  // SearchableSelect no tiene valor inicial propio, así que tras un error se conserva.
  const [operatorId, setOperatorId] = useState("");

  const leave = useCallback(() => {
    router.push(progressHref);
  }, [router, progressHref]);
  const { controls, markDirty, trackFocus, discardDialog } = useDiscardGuard({ onLeave: leave });

  // Mientras la acción está pendiente, Cancelar no sale.
  useEffect(() => {
    controls.setBusy(pending);
  }, [controls, pending]);

  // Un aviso por operación; tras guardar sale sin preguntar.
  useFormResult(state, pending, { successNotification, onSuccess: controls.closeAfterSave });

  // Un clic normal en Cancelar pasa por el descarte; con una tecla de modificador o la rueda, el
  // enlace abre la página en otra pestaña.
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
        onInput={() => markDirty(true)}
        onFocus={trackFocus}
        className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <input type="hidden" name="id_avance" value={idAvance} />

        <FormErrorAlert state={state} />

        <div className="space-y-2">
          <SearchableSelect
            id={OPERATOR_FIELD}
            name={OPERATOR_FIELD}
            label="Nuevo operario"
            placeholder="Buscar operario activo..."
            items={operators}
            value={operatorId}
            required
            disabled={disabled}
            emptyMessage="No hay operarios activos disponibles."
            onValueChange={setOperatorId}
            {...(operatorErrors?.length
              ? { "aria-invalid": true as const, "aria-describedby": `${OPERATOR_FIELD}-error` }
              : {})}
          />
          <FieldError id={`${OPERATOR_FIELD}-error`} messages={operatorErrors} />
        </div>

        <Field
          id="motivo"
          label="Motivo de reasignación"
          required
          disabled={disabled}
          errors={fieldErrors?.motivo}
        >
          {(control) => (
            <Textarea
              {...control}
              name="motivo"
              rows={4}
              maxLength={255}
              defaultValue={values?.motivo}
              placeholder="Ej. Operario reasignado por carga de trabajo o ausencia."
            />
          )}
        </Field>

        <div className="flex items-center justify-between pt-4">
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href={progressHref} onClick={handleCancel}>
              Cancelar
            </Link>
          </Button>

          <SubmitButton disabled={disabled} pendingText="Guardando...">
            Guardar reasignación
          </SubmitButton>
        </div>
      </ActionForm>

      <DiscardConfirmDialog {...discardDialog} {...DISCARD} />
    </>
  );
}
