import { createSupplierPaymentAction } from "@/modules/inventory/supplier-payments/actions";

type SupplierPaymentFormProps = {
  idCompra: string;
  saldoPendiente: number;
};

export function SupplierPaymentForm({
  idCompra,
  saldoPendiente,
}: SupplierPaymentFormProps) {
  return (
    <form
      action={createSupplierPaymentAction}
      className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
    >
      <input type="hidden" name="id_compra" value={idCompra} />

      <div>
        <h2 className="text-lg font-semibold">Registrar pago</h2>
        <p className="text-sm text-slate-600">
          Saldo pendiente actual:{" "}
          <span className="font-semibold">S/ {saldoPendiente.toFixed(2)}</span>
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Fecha de pago *</label>
          <input
            name="fecha_pago"
            type="date"
            required
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Monto pagado *</label>
          <input
            name="monto_pagado"
            type="number"
            step="0.01"
            min="0.01"
            max={saldoPendiente}
            required
            placeholder="0.00"
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Método de pago *</label>
          <select
            name="metodo_pago"
            required
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="">Seleccione método</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="yape">Yape</option>
            <option value="plin">Plin</option>
            <option value="otro">Otro</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Observaciones</label>
        <textarea
          name="observaciones"
          rows={3}
          placeholder="Notas del pago realizado"
          className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Guardar pago
        </button>
      </div>
    </form>
  );
}