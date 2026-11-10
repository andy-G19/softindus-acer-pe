"use client";

import { useActionState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { useFormResult } from "@/components/forms/form-surface";
import { OperationKeyField } from "@/components/forms/operation-key-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type {
  SupplierPaymentFormState,
  SupplierPaymentFormValues,
} from "@/modules/inventory/supplier-payments/actions";

type SupplierPaymentFormProps = {
  action: (
    prevState: SupplierPaymentFormState,
    formData: FormData,
  ) => Promise<SupplierPaymentFormState>;
  idCompra: string;
  /** Saldo pendiente con dos decimales (calculatePurchaseBalance). */
  saldoPendiente: string;
  /** Aviso del catalogo de Inventario; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

const initialState: SupplierPaymentFormState = { status: "idle" };

const EMPTY_VALUES: SupplierPaymentFormValues = {
  fecha_pago: "",
  monto_pagado: "",
  metodo_pago: "",
  observaciones: "",
};

const PAYMENT_METHODS = [
  ["efectivo", "Efectivo"],
  ["transferencia", "Transferencia"],
  ["yape", "Yape"],
  ["plin", "Plin"],
  ["otro", "Otro"],
] as const;

// Registro de un pago en el detalle de la compra (C4 de la 11.2a). Con error el
// mensaje queda en la seccion con lo escrito y el campo marcado; con exito hay un
// solo aviso, el formulario vuelve a quedar vacio y la revalidacion repinta el
// saldo y el historial. La clave de la operacion evita registrar dos veces el mismo
// pago si se reenvia tras una respuesta perdida (OperationKeyField).
export function SupplierPaymentForm({
  action,
  idCompra,
  saldoPendiente,
  successNotification,
}: SupplierPaymentFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const values = state.status === "error" ? state.values : EMPTY_VALUES;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;
  const completedKey = state.status === "success" ? state.data.clave_operacion : undefined;

  useFormResult(state, pending, { successNotification });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registrar pago</CardTitle>
        <p className="text-sm text-muted-foreground">
          Saldo pendiente actual:{" "}
          <span className="font-semibold text-foreground">S/ {saldoPendiente}</span>
        </p>
      </CardHeader>

      <CardContent>
        <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="space-y-5">
          <input type="hidden" name="id_compra" value={idCompra} />
          <OperationKeyField scope={`pago_proveedor:${idCompra}`} completedKey={completedKey} />

          {state.status === "error" ? (
            <Alert variant="destructive" role="alert" aria-live="polite">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-5 md:grid-cols-3">
            <Field id="fecha_pago" label="Fecha de pago" required errors={fieldErrors?.fecha_pago}>
              {(control) => (
                <Input {...control} name="fecha_pago" type="date" defaultValue={values.fecha_pago} />
              )}
            </Field>

            <Field id="monto_pagado" label="Monto pagado" required errors={fieldErrors?.monto_pagado}>
              {(control) => (
                <Input
                  {...control}
                  name="monto_pagado"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={saldoPendiente}
                  placeholder="0.00"
                  defaultValue={values.monto_pagado}
                />
              )}
            </Field>

            <Field id="metodo_pago" label="Método de pago" required errors={fieldErrors?.metodo_pago}>
              {(control) => (
                <NativeSelect {...control} name="metodo_pago" defaultValue={values.metodo_pago}>
                  <option value="">Seleccione método</option>
                  {PAYMENT_METHODS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
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
                rows={3}
                placeholder="Notas del pago realizado"
                defaultValue={values.observaciones}
              />
            )}
          </Field>

          <div className="flex justify-end">
            <SubmitButton pendingText="Guardando...">Guardar pago</SubmitButton>
          </div>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
