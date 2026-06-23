"use client";

import { useState } from "react";

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
    <form action={createPaymentAction} className="space-y-4 rounded-lg border p-4">
      <input type="hidden" name="id_proforma" value={quoteId} />

      <div>
        <h3 className="font-semibold">Registrar pago de cliente</h3>
        <p className="text-sm text-muted-foreground">
          Registra adelantos, amortizaciones o cancelaciones para actualizar el
          saldo de la proforma.
        </p>
      </div>

      {isPaid && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Esta proforma ya está pagada. No requiere nuevos pagos.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Monto pagado</label>
          <input
            name="monto_pagado"
            type="number"
            min="0.01"
            max={balance}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full rounded-md border px-3 py-2"
            placeholder="Ejemplo: 150.00"
            required
            disabled={isPaid}
          />
          <button
            type="button"
            onClick={() => setAmount(balance.toFixed(2))}
            className="text-xs font-medium text-primary hover:underline"
            disabled={isPaid}
          >
            Usar saldo total: {formatMoney(balance)}
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Método de pago</label>
          <select
            name="metodo_pago"
            className="w-full rounded-md border px-3 py-2"
            required
            disabled={isPaid}
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="yape">Yape</option>
            <option value="plin">Plin</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Tipo de pago</label>
          <select
            name="tipo_pago"
            className="w-full rounded-md border px-3 py-2"
            required
            disabled={isPaid}
          >
            <option value="amortizacion">Amortización</option>
            <option value="adelanto">Adelanto</option>
            <option value="cancelacion">Cancelación</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
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
        <label className="text-sm font-medium">Observaciones</label>
        <textarea
          name="observaciones"
          className="min-h-20 w-full rounded-md border px-3 py-2"
          placeholder="Ejemplo: Pago recibido por Yape. Cliente cancela saldo pendiente."
          disabled={isPaid}
        />
      </div>

      <button
        type="submit"
        disabled={isPaid}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        Registrar pago
      </button>
    </form>
  );
}