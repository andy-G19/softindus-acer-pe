"use client";

import { useActionState, useState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { useFormResult } from "@/components/forms/form-surface";
import { OperationKeyField } from "@/components/forms/operation-key-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { calculateClientPayment } from "@/lib/client-payment-amounts";
import { formatMoney } from "@/lib/formatters";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { PaymentFormState, PaymentFormValues } from "@/modules/commercial/payments/actions";

type PaymentFormProps = {
  action: (prevState: PaymentFormState, formData: FormData) => Promise<PaymentFormState>;
  quoteId: string;
  currentBalance: string;
  /**
   * La proforma no admite pagos (anulada, pagada o sin saldo). El formulario sigue montado y
   * deshabilitado: el pago que salda la proforma llega con el detalle ya pagado, y el aviso de
   * su exito lo da este componente (hallazgo 9 de la 11.2a).
   */
  isPaid: boolean;
  /** Aviso del catalogo de Comercial; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

const initialState: PaymentFormState = { status: "idle" };

const EMPTY_VALUES: PaymentFormValues = {
  monto_pagado: "",
  metodo_pago: "efectivo",
  tipo_pago: "amortizacion",
  observaciones: "",
};

// Registro de un pago de cliente en el detalle de la proforma (C5 de la 11.3a), como el pago a
// proveedor: con error el mensaje queda en la seccion con lo escrito y el campo marcado; con
// exito hay un solo aviso, el formulario vuelve a quedar vacio y la revalidacion repinta el
// saldo y el historial. La clave de la operacion evita registrar dos veces el mismo pago si se
// reenvia tras una respuesta perdida (OperationKeyField).
export function PaymentForm({ action, quoteId, currentBalance, isPaid, successNotification }: PaymentFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const values = state.status === "error" ? state.values : EMPTY_VALUES;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;
  const completedKey = state.status === "success" ? state.data.clave_operacion : undefined;

  // El monto escrito alimenta la vista previa del saldo. Se reinicia con cada respuesta, igual
  // que el campo, que ActionForm remonta con lo enviado (error) o vacio (exito).
  const [amount, setAmount] = useState("");
  const [amountKey, setAmountKey] = useState(resultKey);

  if (amountKey !== resultKey) {
    setAmountKey(resultKey);
    setAmount(values.monto_pagado);
  }

  const balance = Number(currentBalance);
  // C2 de la 11.3a: la vista previa usa la regla de la accion (client-payment-amounts.ts). Un
  // pago mayor que el saldo muestra saldo cero, como antes; la accion lo rechaza.
  const payment = calculateClientPayment({ balance: currentBalance, amount: amount || 0 });
  const nextBalance = payment.accepted ? payment.newBalance : 0;

  useFormResult(state, pending, { successNotification });

  return (
    <ActionForm
      action={formAction}
      pending={pending}
      resultKey={resultKey}
      className="space-y-4 rounded-lg border border-border/80 bg-card p-4"
    >
      <input type="hidden" name="id_proforma" value={quoteId} />
      <OperationKeyField scope={`pago_cliente:${quoteId}`} completedKey={completedKey} />

      <div>
        <h3 className="font-semibold">Registrar pago de cliente</h3>
        <p className="text-sm text-muted-foreground">
          Registra adelantos, amortizaciones o cancelaciones para actualizar el saldo de la proforma.
        </p>
      </div>

      {isPaid && (
        <Alert variant="success">
          <AlertDescription>Esta proforma ya está pagada. No requiere nuevos pagos.</AlertDescription>
        </Alert>
      )}

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Field id="monto_pagado" label="Monto pagado" required disabled={isPaid} errors={fieldErrors?.monto_pagado}>
            {(control) => (
              <Input
                {...control}
                name="monto_pagado"
                type="number"
                min="0.01"
                max={balance}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Ejemplo: 150.00"
              />
            )}
          </Field>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => setAmount(balance.toFixed(2))}
            disabled={isPaid}
          >
            Usar saldo total: {formatMoney(balance)}
          </Button>
        </div>

        <Field id="metodo_pago" label="Método de pago" required disabled={isPaid} errors={fieldErrors?.metodo_pago}>
          {(control) => (
            <NativeSelect {...control} name="metodo_pago" defaultValue={values.metodo_pago}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="yape">Yape</option>
              <option value="plin">Plin</option>
              <option value="otro">Otro</option>
            </NativeSelect>
          )}
        </Field>

        <Field id="tipo_pago" label="Tipo de pago" required disabled={isPaid} errors={fieldErrors?.tipo_pago}>
          {(control) => (
            <NativeSelect {...control} name="tipo_pago" defaultValue={values.tipo_pago}>
              <option value="amortizacion">Amortización</option>
              <option value="adelanto">Adelanto</option>
              <option value="cancelacion">Cancelación</option>
            </NativeSelect>
          )}
        </Field>
      </div>

      <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-sm">
        <div className="flex justify-between">
          <span>Saldo actual</span>
          <span className="font-medium">{formatMoney(balance)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>Saldo después del pago</span>
          <span className="font-bold">{formatMoney(nextBalance)}</span>
        </div>
      </div>

      {/* El detalle de la proforma tambien tiene el formulario del comprobante, con sus propias
          observaciones: un id distinto evita dos elementos con el mismo id en la pagina. */}
      <Field id="pago_observaciones" label="Observaciones" disabled={isPaid} errors={fieldErrors?.observaciones}>
        {(control) => (
          <Textarea
            {...control}
            name="observaciones"
            className="min-h-20"
            placeholder="Ejemplo: Pago recibido por Yape. Cliente cancela saldo pendiente."
            defaultValue={values.observaciones}
          />
        )}
      </Field>

      <SubmitButton pendingText="Registrando..." disabled={isPaid}>
        Registrar pago
      </SubmitButton>
    </ActionForm>
  );
}
