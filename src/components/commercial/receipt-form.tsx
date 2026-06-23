"use client";

import { useState } from "react";

import { createReceiptAction } from "@/modules/commercial/receipts/actions";

type ReceiptFormProps = {
  quoteId: string;
  suggestedAmount: string;
  hasReceipt: boolean;
};

function formatMoney(value: string | number) {
  return `S/ ${Number(value).toFixed(2)}`;
}

function buildSuggestedNumber(type: string) {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(
    2,
    "0"
  )}${String(now.getMinutes()).padStart(2, "0")}`;

  if (type === "boleta") {
    return `B001-${timestamp}`;
  }

  if (type === "factura") {
    return `F001-${timestamp}`;
  }

  if (type === "recibo") {
    return `R001-${timestamp}`;
  }

  return `C001-${timestamp}`;
}

export function ReceiptForm({
  quoteId,
  suggestedAmount,
  hasReceipt,
}: ReceiptFormProps) {
  const [type, setType] = useState("boleta");
  const [number, setNumber] = useState(() => buildSuggestedNumber("boleta"));

  return (
    <form
      action={createReceiptAction}
      className="space-y-4 rounded-lg border p-4"
    >
      <input type="hidden" name="id_proforma" value={quoteId} />

      <div>
        <h3 className="font-semibold">Registrar comprobante de venta</h3>
        <p className="text-sm text-muted-foreground">
          Registra boleta, factura, recibo u otro comprobante básico asociado a
          la proforma.
        </p>
      </div>

      {hasReceipt && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Esta proforma ya tiene un comprobante emitido.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Tipo</label>
          <select
            name="tipo_comprobante"
            value={type}
            onChange={(event) => {
              const nextType = event.target.value;

              setType(nextType);
              setNumber(buildSuggestedNumber(nextType));
            }}
            className="w-full rounded-md border px-3 py-2"
            disabled={hasReceipt}
            required
          >
            <option value="boleta">Boleta</option>
            <option value="factura">Factura</option>
            <option value="recibo">Recibo</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Número</label>
          <input
            name="numero_comprobante"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            className="w-full rounded-md border px-3 py-2"
            disabled={hasReceipt}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Monto total</label>
          <input
            name="monto_total"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={Number(suggestedAmount).toFixed(2)}
            className="w-full rounded-md border px-3 py-2"
            disabled={hasReceipt}
            required
          />
          <p className="text-xs text-muted-foreground">
            Monto sugerido: {formatMoney(suggestedAmount)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Observaciones</label>
        <textarea
          name="observaciones"
          className="min-h-20 w-full rounded-md border px-3 py-2"
          placeholder="Ejemplo: Comprobante emitido por cancelación del pedido."
          disabled={hasReceipt}
        />
      </div>

      <button
        type="submit"
        disabled={hasReceipt}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        Registrar comprobante
      </button>
    </form>
  );
}