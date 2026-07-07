"use client";

import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createPaymentAction } from "@/modules/commercial/payments/actions";

type PaymentFormProps = {
  quoteId: string;
  currentBalance: string;
  isPaid: boolean;
};

function formatMoney(value: string | number) {
  return `S/ ${Number(value).toFixed(2)}`;
}

export function PaymentForm({
  quoteId,
  currentBalance,
  isPaid,
}: PaymentFormProps) {
  const [amount, setAmount] = useState("");
  const balance = Number(currentBalance);
  const amountNumber = Number(amount || 0);
  const nextBalance = Math.max(balance - amountNumber, 0);

  return (
    <form
      action={createPaymentAction}
      className="space-y-4 rounded-lg border border-border/80 bg-card p-4"
    >
      <input type="hidden" name="id_proforma" value={quoteId} />

      <div>
        <h3 className="font-semibold">Registrar pago de cliente</h3>
        <p className="text-sm text-muted-foreground">
          Registra adelantos, amortizaciones o cancelaciones para actualizar el
          saldo de la proforma.
        </p>
      </div>

      {isPaid && (
        <Alert variant="success">
          <AlertDescription>
            Esta proforma ya está pagada. No requiere nuevos pagos.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Monto pagado</Label>
          <Input
            name="monto_pagado"
            type="number"
            min="0.01"
            max={balance}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Ejemplo: 150.00"
            required
            disabled={isPaid}
          />
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

        <div className="space-y-2">
          <Label>Método de pago</Label>
          <NativeSelect name="metodo_pago" required disabled={isPaid}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="yape">Yape</option>
            <option value="plin">Plin</option>
            <option value="otro">Otro</option>
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label>Tipo de pago</Label>
          <NativeSelect name="tipo_pago" required disabled={isPaid}>
            <option value="amortizacion">Amortización</option>
            <option value="adelanto">Adelanto</option>
            <option value="cancelacion">Cancelación</option>
          </NativeSelect>
        </div>
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

      <div className="space-y-2">
        <Label>Observaciones</Label>
        <Textarea
          name="observaciones"
          className="min-h-20"
          placeholder="Ejemplo: Pago recibido por Yape. Cliente cancela saldo pendiente."
          disabled={isPaid}
        />
      </div>

      <Button type="submit" disabled={isPaid}>
        Registrar pago
      </Button>
    </form>
  );
}