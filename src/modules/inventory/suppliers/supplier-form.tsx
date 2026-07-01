"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { SupplierFormState } from "@/modules/inventory/suppliers/actions";

type SupplierTypeOption = {
  slug: string;
  nombre: string;
};

type SupplierFormValues = {
  id_proveedor?: string;
  razon_social: string;
  tipo_documento: string;
  numero_documento: string;
  telefono: string;
  correo: string;
  direccion: string;
  contacto_principal: string;
  tipo_proveedor: string;
  condicion_pago: string;
  observaciones: string;
};

type SupplierFormProps = {
  action: (
    prevState: SupplierFormState,
    formData: FormData,
  ) => Promise<SupplierFormState>;
  supplierTypes: SupplierTypeOption[];
  defaultValues?: Partial<SupplierFormValues>;
  submitLabel: string;
};

const initialState: SupplierFormState = {
  error: "",
};

function getValue(
  defaultValues: Partial<SupplierFormValues> | undefined,
  field: keyof SupplierFormValues,
) {
  return defaultValues?.[field] ?? "";
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-red-600">{messages[0]}</p>;
}

export function SupplierForm({
  action,
  supplierTypes,
  defaultValues,
  submitLabel,
}: SupplierFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const hasSupplierTypes = supplierTypes.length > 0;

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
    >
      {defaultValues?.id_proveedor ? (
        <input
          type="hidden"
          name="id_proveedor"
          value={defaultValues.id_proveedor}
        />
      ) : null}

      {state.error ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </div>
      ) : null}

      {!hasSupplierTypes ? (
        <div className="rounded-md border border-dashed px-4 py-3 text-sm text-slate-600">
          No hay tipos de proveedor activos.{" "}
          <Link
            href="/dashboard/inventory/supplier-types"
            className="font-medium text-slate-900 underline-offset-4 hover:underline"
          >
            Crear tipos de proveedor
          </Link>
          .
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="razon_social" className="text-sm font-medium">
          Razón social *
        </label>
        <input
          id="razon_social"
          name="razon_social"
          required
          placeholder="Ej. Aceros del Sur S.A.C."
          defaultValue={getValue(defaultValues, "razon_social")}
          className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
        />
        <FieldError messages={state.fieldErrors?.razon_social} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="tipo_documento" className="text-sm font-medium">
            Tipo de documento
          </label>
          <select
            id="tipo_documento"
            name="tipo_documento"
            defaultValue={getValue(defaultValues, "tipo_documento")}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="">Sin documento</option>
            <option value="ruc">RUC</option>
            <option value="dni">DNI</option>
            <option value="otro">Otro</option>
          </select>
          <FieldError messages={state.fieldErrors?.tipo_documento} />
        </div>

        <div className="space-y-2">
          <label htmlFor="numero_documento" className="text-sm font-medium">
            Número de documento
          </label>
          <input
            id="numero_documento"
            name="numero_documento"
            placeholder="Ej. 20601234567"
            defaultValue={getValue(defaultValues, "numero_documento")}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.numero_documento} />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="telefono" className="text-sm font-medium">
            Teléfono
          </label>
          <input
            id="telefono"
            name="telefono"
            placeholder="Ej. 999 888 777"
            defaultValue={getValue(defaultValues, "telefono")}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.telefono} />
        </div>

        <div className="space-y-2">
          <label htmlFor="correo" className="text-sm font-medium">
            Correo
          </label>
          <input
            id="correo"
            name="correo"
            type="email"
            placeholder="proveedor@correo.com"
            defaultValue={getValue(defaultValues, "correo")}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.correo} />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="direccion" className="text-sm font-medium">
          Dirección
        </label>
        <input
          id="direccion"
          name="direccion"
          placeholder="Dirección comercial"
          defaultValue={getValue(defaultValues, "direccion")}
          className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
        />
        <FieldError messages={state.fieldErrors?.direccion} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="contacto_principal" className="text-sm font-medium">
            Contacto principal
          </label>
          <input
            id="contacto_principal"
            name="contacto_principal"
            placeholder="Nombre de la persona de contacto"
            defaultValue={getValue(defaultValues, "contacto_principal")}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.contacto_principal} />
        </div>

        <div className="space-y-2">
          <label htmlFor="tipo_proveedor" className="text-sm font-medium">
            Tipo de proveedor *
          </label>
          <select
            id="tipo_proveedor"
            name="tipo_proveedor"
            required
            disabled={!hasSupplierTypes}
            defaultValue={getValue(defaultValues, "tipo_proveedor")}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <option value="">Selecciona un tipo</option>
            {supplierTypes.map((type) => (
              <option key={type.slug} value={type.slug}>
                {type.nombre}
              </option>
            ))}
          </select>
          <FieldError messages={state.fieldErrors?.tipo_proveedor} />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="condicion_pago" className="text-sm font-medium">
          Condición de pago
        </label>
        <select
          id="condicion_pago"
          name="condicion_pago"
          defaultValue={getValue(defaultValues, "condicion_pago")}
          className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">No especificado</option>
          <option value="contado">Contado</option>
          <option value="credito">Crédito</option>
          <option value="parcial">Parcial</option>
          <option value="otro">Otro</option>
        </select>
        <FieldError messages={state.fieldErrors?.condicion_pago} />
      </div>

      <div className="space-y-2">
        <label htmlFor="observaciones" className="text-sm font-medium">
          Observaciones
        </label>
        <textarea
          id="observaciones"
          name="observaciones"
          rows={4}
          placeholder="Notas adicionales sobre el proveedor"
          defaultValue={getValue(defaultValues, "observaciones")}
          className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
        />
        <FieldError messages={state.fieldErrors?.observaciones} />
      </div>

      <div className="flex items-center justify-between pt-4">
        <Link
          href="/dashboard/inventory/suppliers"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Volver a proveedores
        </Link>

        <button
          type="submit"
          disabled={isPending || !hasSupplierTypes}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Guardando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
