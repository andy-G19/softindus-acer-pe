"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { MaterialFormState } from "@/modules/inventory/materials/actions";

type MaterialCategoryOption = {
  slug: string;
  nombre: string;
};

type MaterialFormValues = {
  id_material?: string;
  nombre_material: string;
  categoria: string;
  unidad_medida: string;
  stock_actual: string;
  stock_reservado: string;
  stock_minimo: string;
  costo_unitario_actual: string;
};

type MaterialFormProps = {
  action: (
    prevState: MaterialFormState,
    formData: FormData,
  ) => Promise<MaterialFormState>;
  categories: MaterialCategoryOption[];
  defaultValues?: Partial<MaterialFormValues>;
  submitLabel: string;
  mode: "create" | "edit";
};

const initialState: MaterialFormState = {
  error: "",
};

function getValue(
  defaultValues: Partial<MaterialFormValues> | undefined,
  field: keyof MaterialFormValues,
) {
  return defaultValues?.[field] ?? "";
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-red-600">{messages[0]}</p>;
}

export function MaterialForm({
  action,
  categories,
  defaultValues,
  submitLabel,
  mode,
}: MaterialFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const hasCategories = categories.length > 0;

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
    >
      {defaultValues?.id_material ? (
        <input
          type="hidden"
          name="id_material"
          value={defaultValues.id_material}
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

      {!hasCategories ? (
        <div className="rounded-md border border-dashed px-4 py-3 text-sm text-slate-600">
          No hay categorías de materiales activas.{" "}
          <Link
            href="/dashboard/inventory/material-categories"
            className="font-medium text-slate-900 underline-offset-4 hover:underline"
          >
            Crear categorías de materiales
          </Link>
          .
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="nombre_material" className="text-sm font-medium">
          Nombre del material *
        </label>
        <input
          id="nombre_material"
          name="nombre_material"
          required
          placeholder="Ej. Plancha metálica 1/20"
          defaultValue={getValue(defaultValues, "nombre_material")}
          className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
        />
        <FieldError messages={state.fieldErrors?.nombre_material} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="categoria" className="text-sm font-medium">
            Categoría *
          </label>
          <select
            id="categoria"
            name="categoria"
            required
            disabled={!hasCategories}
            defaultValue={getValue(defaultValues, "categoria")}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <option value="">Selecciona una categoría</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.nombre}
              </option>
            ))}
          </select>
          <FieldError messages={state.fieldErrors?.categoria} />
        </div>

        <div className="space-y-2">
          <label htmlFor="unidad_medida" className="text-sm font-medium">
            Unidad de medida *
          </label>
          <input
            id="unidad_medida"
            name="unidad_medida"
            required
            placeholder="Ej. kg, unidad, metro, plancha"
            defaultValue={getValue(defaultValues, "unidad_medida")}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.unidad_medida} />
        </div>
      </div>

      {mode === "create" ? (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="stock_actual" className="text-sm font-medium">
              Stock actual *
            </label>
            <input
              id="stock_actual"
              name="stock_actual"
              type="number"
              step="0.01"
              min="0"
              defaultValue={getValue(defaultValues, "stock_actual") || "0"}
              required
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
            <FieldError messages={state.fieldErrors?.stock_actual} />
          </div>

          <div className="space-y-2">
            <label htmlFor="stock_reservado" className="text-sm font-medium">
              Stock reservado *
            </label>
            <input
              id="stock_reservado"
              name="stock_reservado"
              type="number"
              step="0.01"
              min="0"
              defaultValue={getValue(defaultValues, "stock_reservado") || "0"}
              required
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
            <FieldError messages={state.fieldErrors?.stock_reservado} />
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <span className="text-sm font-medium">Stock actual</span>
            <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm">
              {getValue(defaultValues, "stock_actual") || "0.00"}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Stock reservado</span>
            <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm">
              {getValue(defaultValues, "stock_reservado") || "0.00"}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="stock_minimo" className="text-sm font-medium">
            Stock mínimo *
          </label>
          <input
            id="stock_minimo"
            name="stock_minimo"
            type="number"
            step="0.01"
            min="0"
            defaultValue={getValue(defaultValues, "stock_minimo") || "0"}
            required
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.stock_minimo} />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="costo_unitario_actual"
            className="text-sm font-medium"
          >
            Costo unitario actual *
          </label>
          <input
            id="costo_unitario_actual"
            name="costo_unitario_actual"
            type="number"
            step="0.01"
            min="0"
            defaultValue={
              getValue(defaultValues, "costo_unitario_actual") || "0"
            }
            required
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.costo_unitario_actual} />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <Link
          href="/dashboard/inventory/materials"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Volver a materiales
        </Link>

        <button
          type="submit"
          disabled={isPending || !hasCategories}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Guardando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
