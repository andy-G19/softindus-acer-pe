"use client";

import { useActionState, useEffect, useRef } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { useFormResult } from "@/components/forms/form-surface";
import { OperationKeyField } from "@/components/forms/operation-key-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { calculateQuoteTotal } from "@/lib/client-payment-amounts";
import { formatMoney } from "@/lib/formatters";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { ReceiptFormState } from "@/modules/commercial/receipts/actions";

type ReceiptFormProps = {
  action: (prevState: ReceiptFormState, formData: FormData) => Promise<ReceiptFormState>;
  quoteId: string;
  suggestedAmount: string;
  /**
   * La proforma ya tiene un comprobante emitido o esta anulada. El formulario sigue montado y
   * deshabilitado: el comprobante que se emite llega con el detalle ya repintado, y el aviso de
   * su exito lo da este componente (hallazgo 9 de la 11.2a).
   */
  hasReceipt: boolean;
  /** Aviso del catalogo de Comercial; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

const initialState: ReceiptFormState = { status: "idle" };

const NUMBER_PREFIX: Record<string, string> = { boleta: "B001", factura: "F001", recibo: "R001" };

/**
 * Numero sugerido con la fecha y la hora del equipo de quien emite. Solo se calcula en el
 * navegador: calculado tambien en el servidor (en UTC) no coincidia con la hidratacion (en hora
 * de Lima) (hallazgo 2 del plan de la 11.3b).
 */
function buildSuggestedNumber(type: string) {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;

  return `${NUMBER_PREFIX[type] ?? "C001"}-${timestamp}`;
}

// Registro del comprobante de venta en el detalle de la proforma (C6 de la 11.3b, D32), como el
// pago de cliente: con error el mensaje queda en la seccion con lo escrito y el campo marcado (un
// numero repetido, tambien en carrera, va a su campo); con exito hay un solo aviso y la
// revalidacion repinta el detalle con el comprobante emitido. La clave de la operacion evita
// emitir dos veces si se reenvia tras una respuesta perdida (OperationKeyField).
export function ReceiptForm({ action, quoteId, suggestedAmount, hasReceipt, successNotification }: ReceiptFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const numberRef = useRef<HTMLInputElement>(null);

  const values = state.status === "error" ? state.values : undefined;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;
  const completedKey = state.status === "success" ? state.data.clave_operacion : undefined;

  useFormResult(state, pending, { successNotification });

  // El numero sugerido se escribe en el campo despues de montar (y de cada remontaje de
  // ActionForm), solo si esta vacio: tras un error el campo trae lo que se envio.
  useEffect(() => {
    const input = numberRef.current;

    if (input && !input.value && !input.disabled) {
      const type = input.form?.querySelector<HTMLSelectElement>("[name=tipo_comprobante]")?.value ?? "boleta";

      input.value = buildSuggestedNumber(type);
    }
  }, [resultKey, hasReceipt]);

  return (
    <ActionForm
      action={formAction}
      pending={pending}
      resultKey={resultKey}
      className="space-y-4 rounded-lg border border-border/80 bg-card p-4"
    >
      <input type="hidden" name="id_proforma" value={quoteId} />
      <OperationKeyField scope={`comprobante:${quoteId}`} completedKey={completedKey} />

      <div>
        <h3 className="font-semibold">Registrar comprobante de venta</h3>
        <p className="text-sm text-muted-foreground">
          Registra boleta, factura, recibo u otro comprobante básico asociado a la proforma.
        </p>
      </div>

      {hasReceipt && (
        <Alert variant="success">
          <AlertDescription>Esta proforma ya tiene un comprobante emitido.</AlertDescription>
        </Alert>
      )}

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Field id="tipo_comprobante" label="Tipo" required disabled={hasReceipt} errors={fieldErrors?.tipo_comprobante}>
          {(control) => (
            <NativeSelect
              {...control}
              name="tipo_comprobante"
              defaultValue={values?.tipo_comprobante ?? "boleta"}
              onChange={(event) => {
                if (numberRef.current) {
                  numberRef.current.value = buildSuggestedNumber(event.target.value);
                }
              }}
            >
              <option value="boleta">Boleta</option>
              <option value="factura">Factura</option>
              <option value="recibo">Recibo</option>
              <option value="otro">Otro</option>
            </NativeSelect>
          )}
        </Field>

        <Field
          id="numero_comprobante"
          label="Número"
          required
          disabled={hasReceipt}
          errors={fieldErrors?.numero_comprobante}
        >
          {(control) => (
            <Input
              {...control}
              ref={numberRef}
              name="numero_comprobante"
              defaultValue={values?.numero_comprobante ?? ""}
              autoComplete="off"
            />
          )}
        </Field>

        <Field
          id="monto_total"
          label="Monto total"
          required
          disabled={hasReceipt}
          errors={fieldErrors?.monto_total}
          description={`Monto sugerido: ${formatMoney(suggestedAmount)}`}
        >
          {(control) => (
            <Input
              {...control}
              name="monto_total"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={values?.monto_total ?? calculateQuoteTotal([suggestedAmount])}
            />
          )}
        </Field>
      </div>

      {/* El detalle de la proforma tambien tiene el formulario de pago, con sus propias
          observaciones: un id distinto evita dos elementos con el mismo id en la pagina. */}
      <Field id="comprobante_observaciones" label="Observaciones" disabled={hasReceipt} errors={fieldErrors?.observaciones}>
        {(control) => (
          <Textarea
            {...control}
            name="observaciones"
            className="min-h-20"
            placeholder="Ejemplo: Comprobante emitido por cancelación del pedido."
            defaultValue={values?.observaciones ?? ""}
          />
        )}
      </Field>

      <SubmitButton pendingText="Registrando..." disabled={hasReceipt}>
        Registrar comprobante
      </SubmitButton>
    </ActionForm>
  );
}
