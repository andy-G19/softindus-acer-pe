"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { InventoryOutputFormState } from "@/modules/inventory/movements/actions";

type Option = {
  id: string;
  label: string;
};

type InventoryOutputFormProps = {
  action: (
    prevState: InventoryOutputFormState,
    formData: FormData,
  ) => Promise<InventoryOutputFormState>;
  materials: Option[];
  workOrders: Option[];
};

const initialState: InventoryOutputFormState = { error: "" };

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function InventoryOutputForm({
  action,
  materials,
  workOrders,
}: InventoryOutputFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border bg-white p-6">
      {state.error ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="id_material" className="text-sm font-medium">
            Material
          </label>
          <select
            id="id_material"
            name="id_material"
            required
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Seleccione material</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.label}
              </option>
            ))}
          </select>
          <FieldError messages={state.fieldErrors?.id_material} />
        </div>

        <div className="space-y-2">
          <label htmlFor="id_orden_trabajo" className="text-sm font-medium">
            Orden de trabajo
          </label>
          <select
            id="id_orden_trabajo"
            name="id_orden_trabajo"
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Sin orden asociada</option>
            {workOrders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.label}
              </option>
            ))}
          </select>
          <FieldError messages={state.fieldErrors?.id_orden_trabajo} />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="cantidad" className="text-sm font-medium">
          Cantidad
        </label>
        <input
          id="cantidad"
          name="cantidad"
          type="number"
          min="0.01"
          step="0.01"
          required
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <FieldError messages={state.fieldErrors?.cantidad} />
      </div>

      <div className="space-y-2">
        <label htmlFor="motivo" className="text-sm font-medium">
          Motivo
        </label>
        <textarea
          id="motivo"
          name="motivo"
          rows={4}
          required
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <FieldError messages={state.fieldErrors?.motivo} />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
        >
          {isPending ? "Guardando..." : "Registrar salida"}
        </button>
        <Link
          href="/dashboard/inventory/outputs"
          className="rounded-md border px-4 py-2 text-sm font-medium"
        >
          Volver
        </Link>
      </div>
    </form>
  );
}
