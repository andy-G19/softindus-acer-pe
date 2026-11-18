"use client";

import { useActionState, useState, type ReactNode } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { useFormResult } from "@/components/forms/form-surface";
import { OperationKeyField } from "@/components/forms/operation-key-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type {
  AdditionalDeliveryFormState,
  MaterialReturnFormState,
} from "@/modules/production/work-orders/actions";

export type MaterialMovementOption = {
  idRequerimiento: string;
  materialName: string;
  unidad: string;
  /** Stock disponible hoy en almacén, para la entrega adicional. */
  stockActual: number;
  /** Lo entregado que aún no se devolvió: tope de una devolución. */
  returnable: number;
};

type MovementState = AdditionalDeliveryFormState | MaterialReturnFormState;
type MovementAction = (prevState: MovementState, formData: FormData) => Promise<MovementState>;

type MaterialMovementFormProps = {
  idOrdenTrabajo: string;
  options: MaterialMovementOption[];
  additionalAction: (
    prevState: AdditionalDeliveryFormState,
    formData: FormData,
  ) => Promise<AdditionalDeliveryFormState>;
  returnAction: (prevState: MaterialReturnFormState, formData: FormData) => Promise<MaterialReturnFormState>;
  /**
   * Avisos que se dan al guardar, del catálogo de Producción. La página los pasa con su clave
   * literal para que notification-registry.test.ts vea quién emite cada clave.
   */
  additionalNotification: NotificationDefinition;
  returnNotification: NotificationDefinition;
};

type Mode = "adicional" | "devolucion";

const initialState: MovementState = { status: "idle" };

// C1 de la 11.6b (D73): la entrega adicional y la devolución son dos operaciones, cada una con su
// acción y su clave guardada por orden. El selector «Operación» muestra un formulario u otro con el
// mismo aspecto de antes: va dentro de cada uno, en su primera columna, y no se envía.
export function MaterialMovementForm({
  idOrdenTrabajo,
  options,
  additionalAction,
  returnAction,
  additionalNotification,
  returnNotification,
}: MaterialMovementFormProps) {
  const [mode, setMode] = useState<Mode>("adicional");
  const isReturn = mode === "devolucion";

  const modeField = (
    <div className="space-y-2">
      <Label htmlFor="movimiento_modo">Operación</Label>
      {/* Dentro de ActionForm un select usa defaultValue con su onChange (hallazgo 13 de la 10.6a). */}
      <NativeSelect
        id="movimiento_modo"
        defaultValue={mode}
        onChange={(event) => setMode(event.target.value as Mode)}
      >
        <option value="adicional">Entrega adicional</option>
        <option value="devolucion">Devolución al almacén</option>
      </NativeSelect>
      <p className="text-xs text-muted-foreground">
        {isReturn
          ? "Material entregado que vuelve al almacén sin usarse."
          : "Material extra por encima de lo planificado."}
      </p>
    </div>
  );

  // Cada operación es su propio formulario (key): al cambiar de operación empieza vacío.
  return isReturn ? (
    <MovementForm
      key="devolucion"
      mode="devolucion"
      idOrdenTrabajo={idOrdenTrabajo}
      options={options}
      action={returnAction as MovementAction}
      notification={returnNotification}
      modeField={modeField}
    />
  ) : (
    <MovementForm
      key="adicional"
      mode="adicional"
      idOrdenTrabajo={idOrdenTrabajo}
      options={options}
      action={additionalAction as MovementAction}
      notification={additionalNotification}
      modeField={modeField}
    />
  );
}

type MovementFormProps = {
  mode: Mode;
  idOrdenTrabajo: string;
  options: MaterialMovementOption[];
  action: MovementAction;
  notification: NotificationDefinition;
  modeField: ReactNode;
};

const KEY_SCOPE: Record<Mode, string> = {
  adicional: "entrega_adicional",
  devolucion: "devolucion_material",
};

function MovementForm({ mode, idOrdenTrabajo, options, action, notification, modeField }: MovementFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  // Con éxito los campos vuelven a empezar: solo un error devuelve lo enviado.
  const values = state.status === "error" ? state.values : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;
  const completedKey = state.status === "success" ? state.data.clave_operacion : undefined;

  // El material elegido vive aquí: muestra su tope y se conserva tras un error o un guardado.
  const [idRequerimiento, setIdRequerimiento] = useState(options[0]?.idRequerimiento ?? "");

  // Un aviso por operación; el detalle se repinta con la revalidación de la acción.
  useFormResult(state, pending, { successNotification: notification });

  const isReturn = mode === "devolucion";
  const selected = options.find((option) => option.idRequerimiento === idRequerimiento);
  const limit = isReturn ? selected?.returnable ?? 0 : selected?.stockActual ?? 0;
  const limitLabel = isReturn ? "Sin devolver de lo entregado" : "Stock disponible en almacén";

  return (
    <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="space-y-4">
      <OperationKeyField scope={`${KEY_SCOPE[mode]}:${idOrdenTrabajo}`} completedKey={completedKey} />
      <input type="hidden" name="id_orden_trabajo" value={idOrdenTrabajo} />

      <FormErrorAlert state={state} />

      <div className="grid gap-4 md:grid-cols-2">
        {modeField}

        <Field
          id="id_requerimiento"
          label="Material"
          errors={fieldErrors?.id_requerimiento}
          description={
            selected ? (
              <>
                {limitLabel}:{" "}
                <span className="font-medium text-foreground">
                  {limit.toFixed(2)} {selected.unidad}
                </span>
              </>
            ) : undefined
          }
        >
          {(control) => (
            <NativeSelect
              {...control}
              name="id_requerimiento"
              required
              defaultValue={idRequerimiento}
              onChange={(event) => setIdRequerimiento(event.target.value)}
            >
              {options.map((option) => (
                <option key={option.idRequerimiento} value={option.idRequerimiento}>
                  {option.materialName}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>

      <Field id="cantidad" label="Cantidad" required errors={fieldErrors?.cantidad}>
        {(control) => (
          <Input
            {...control}
            name="cantidad"
            type="number"
            min="0.01"
            step="0.01"
            max={limit > 0 ? limit : undefined}
            defaultValue={values?.cantidad}
            placeholder="Ej. 2.50"
          />
        )}
      </Field>

      <Field
        id="motivo"
        label={isReturn ? "Motivo (opcional)" : "Motivo"}
        required={!isReturn}
        errors={fieldErrors?.motivo}
        description={
          isReturn
            ? "Ayuda a entender la devolución, pero no es obligatorio."
            : "Obligatorio: una salida por encima del plan sin explicación es imposible de auditar después."
        }
      >
        {(control) => (
          <Textarea
            {...control}
            name="motivo"
            rows={3}
            maxLength={300}
            defaultValue={values?.motivo}
            placeholder={
              isReturn
                ? "Ej. sobró material del corte."
                : "Ej. se malogró una pieza durante el forjado y hubo que rehacerla."
            }
          />
        )}
      </Field>

      <SubmitButton
        variant={isReturn ? "outline" : "default"}
        pendingText={isReturn ? "Registrando devolución..." : "Registrando entrega..."}
      >
        {isReturn ? "Registrar devolución" : "Registrar entrega adicional"}
      </SubmitButton>
    </ActionForm>
  );
}
