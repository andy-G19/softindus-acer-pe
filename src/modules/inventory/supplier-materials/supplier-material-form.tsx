"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { SupplierMaterialFormState } from "@/modules/inventory/supplier-materials/actions";

type Option = {
  id: string;
  label: string;
};

type SupplierMaterialValues = {
  id_proveedor_material?: string;
  id_proveedor: string;
  id_material: string;
  unidad_medida: string;
  precio_referencial: string;
  tiempo_entrega_dias: string;
  disponibilidad: string;
};

type SupplierMaterialFormProps = {
  action: (
    prevState: SupplierMaterialFormState,
    formData: FormData,
  ) => Promise<SupplierMaterialFormState>;
  suppliers: Option[];
  materials: Option[];
  defaultValues?: Partial<SupplierMaterialValues>;
  submitLabel: string;
};

const initialState: SupplierMaterialFormState = { error: "" };

const availabilityOptions = [
  { value: "", label: "Sin definir" },
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
  { value: "no_disponible", label: "No disponible" },
];

function getValue(
  defaultValues: Partial<SupplierMaterialValues> | undefined,
  field: keyof SupplierMaterialValues,
) {
  return defaultValues?.[field] ?? "";
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function SupplierMaterialForm({
  action,
  suppliers,
  materials,
  defaultValues,
  submitLabel,
}: SupplierMaterialFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const hasOptions = suppliers.length > 0 && materials.length > 0;

  return (
    <form action={formAction} className="space-y-4">
      {defaultValues?.id_proveedor_material ? (
        <input
          type="hidden"
          name="id_proveedor_material"
          value={defaultValues.id_proveedor_material}
        />
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

      {!hasOptions ? (
        <div className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Deben existir proveedores y materiales activos para crear asociaciones.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="id_proveedor" className="text-sm font-medium">
            Proveedor
          </label>
          <select
            id="id_proveedor"
            name="id_proveedor"
            defaultValue={getValue(defaultValues, "id_proveedor")}
            disabled={suppliers.length === 0}
            required
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="">Selecciona un proveedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.label}
              </option>
            ))}
          </select>
          <FieldError messages={state.fieldErrors?.id_proveedor} />
        </div>

        <div className="space-y-2">
          <label htmlFor="id_material" className="text-sm font-medium">
            Material
          </label>
          <select
            id="id_material"
            name="id_material"
            defaultValue={getValue(defaultValues, "id_material")}
            disabled={materials.length === 0}
            required
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="">Selecciona un material</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.label}
              </option>
            ))}
          </select>
          <FieldError messages={state.fieldErrors?.id_material} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="unidad_medida" className="text-sm font-medium">
            Unidad de medida
          </label>
          <input
            id="unidad_medida"
            name="unidad_medida"
            defaultValue={getValue(defaultValues, "unidad_medida")}
            required
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.unidad_medida} />
        </div>

        <div className="space-y-2">
          <label htmlFor="precio_referencial" className="text-sm font-medium">
            Precio referencial
          </label>
          <input
            id="precio_referencial"
            name="precio_referencial"
            type="number"
            min="0"
            step="0.01"
            defaultValue={getValue(defaultValues, "precio_referencial")}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.precio_referencial} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="tiempo_entrega_dias"
            className="text-sm font-medium"
          >
            Tiempo de entrega (dias)
          </label>
          <input
            id="tiempo_entrega_dias"
            name="tiempo_entrega_dias"
            type="number"
            min="0"
            step="1"
            defaultValue={getValue(defaultValues, "tiempo_entrega_dias")}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.tiempo_entrega_dias} />
        </div>

        <div className="space-y-2">
          <label htmlFor="disponibilidad" className="text-sm font-medium">
            Disponibilidad
          </label>
          <select
            id="disponibilidad"
            name="disponibilidad"
            defaultValue={getValue(defaultValues, "disponibilidad")}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          >
            {availabilityOptions.map((option) => (
              <option key={option.value || "empty"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldError messages={state.fieldErrors?.disponibilidad} />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={isPending || !hasOptions}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Guardando..." : submitLabel}
        </button>

        <Link
          href="/dashboard/inventory/supplier-materials"
          className="rounded-md border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
        >
          Volver al listado
        </Link>
      </div>
    </form>
  );
}
