"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { SparePartFormState } from "@/modules/maintenance/spare-parts/actions";

type ProviderOption = {
  id: string;
  label: string;
};

type SparePartValues = {
  id_repuesto?: string;
  id_proveedor: string;
  nombre_repuesto: string;
  descripcion: string;
  costo_unitario: string;
  estado: string;
};

type SparePartFormProps = {
  action: (
    prevState: SparePartFormState,
    formData: FormData,
  ) => Promise<SparePartFormState>;
  providers: ProviderOption[];
  defaultValues?: Partial<SparePartValues>;
  submitLabel: string;
};

const initialState: SparePartFormState = { error: "" };

function getValue(
  defaultValues: Partial<SparePartValues> | undefined,
  field: keyof SparePartValues,
) {
  return defaultValues?.[field] ?? "";
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function SparePartForm({
  action,
  providers,
  defaultValues,
  submitLabel,
}: SparePartFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {defaultValues?.id_repuesto ? (
        <input type="hidden" name="id_repuesto" value={defaultValues.id_repuesto} />
      ) : null}

      {state.error ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="nombre_repuesto" className="text-sm font-medium">
          Nombre del repuesto
        </label>
        <input
          id="nombre_repuesto"
          name="nombre_repuesto"
          required
          defaultValue={getValue(defaultValues, "nombre_repuesto")}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
        <FieldError messages={state.fieldErrors?.nombre_repuesto} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="id_proveedor" className="text-sm font-medium">
            Proveedor
          </label>
          <select
            id="id_proveedor"
            name="id_proveedor"
            defaultValue={getValue(defaultValues, "id_proveedor")}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="">Sin proveedor</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
          <FieldError messages={state.fieldErrors?.id_proveedor} />
        </div>

        <div className="space-y-2">
          <label htmlFor="costo_unitario" className="text-sm font-medium">
            Costo unitario
          </label>
          <input
            id="costo_unitario"
            name="costo_unitario"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={getValue(defaultValues, "costo_unitario")}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.costo_unitario} />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="estado" className="text-sm font-medium">
          Estado
        </label>
        <select
          id="estado"
          name="estado"
          required
          defaultValue={getValue(defaultValues, "estado") || "true"}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </select>
        <FieldError messages={state.fieldErrors?.estado} />
      </div>

      <div className="space-y-2">
        <label htmlFor="descripcion" className="text-sm font-medium">
          Descripcion
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={4}
          defaultValue={getValue(defaultValues, "descripcion")}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
        <FieldError messages={state.fieldErrors?.descripcion} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Guardando..." : submitLabel}
        </button>
        <Link
          href="/dashboard/maintenance/spare-parts"
          className="rounded-md border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
        >
          Volver al listado
        </Link>
      </div>
    </form>
  );
}
