"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { ProductFormState } from "@/modules/commercial/products/actions";

type ProductCategoryOption = {
  slug: string;
  nombre: string;
};

type ProductFormValues = {
  id_producto?: string;
  nombre_producto: string;
  categoria: string;
  descripcion: string;
  unidad_medida: string;
  precio_referencial: string;
};

type ProductFormProps = {
  action: (
    prevState: ProductFormState,
    formData: FormData,
  ) => Promise<ProductFormState>;
  categories: ProductCategoryOption[];
  defaultValues?: Partial<ProductFormValues>;
  submitLabel: string;
};

const initialState: ProductFormState = {
  error: "",
};

const unitOptions = [
  { value: "unidad", label: "Unidad" },
  { value: "docena", label: "Docena" },
  { value: "par", label: "Par" },
  { value: "lote", label: "Lote" },
];

function getValue(
  defaultValues: Partial<ProductFormValues> | undefined,
  field: keyof ProductFormValues,
) {
  return defaultValues?.[field] ?? "";
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function ProductForm({
  action,
  categories,
  defaultValues,
  submitLabel,
}: ProductFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const hasCategories = categories.length > 0;

  return (
    <form action={formAction} className="space-y-4 rounded-lg border p-6">
      {defaultValues?.id_producto ? (
        <input
          type="hidden"
          name="id_producto"
          value={defaultValues.id_producto}
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

      {!hasCategories ? (
        <div className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          No hay categorías activas disponibles.{" "}
          <Link
            href="/dashboard/commercial/product-categories"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Crear categorías de productos
          </Link>
          .
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="nombre_producto" className="text-sm font-medium">
          Nombre del producto
        </label>
        <input
          id="nombre_producto"
          name="nombre_producto"
          placeholder="Ejemplo: Lampa agrícola reforzada"
          className="w-full rounded-md border px-3 py-2"
          defaultValue={getValue(defaultValues, "nombre_producto")}
          required
        />
        <FieldError messages={state.fieldErrors?.nombre_producto} />
      </div>

      <div className="space-y-2">
        <label htmlFor="categoria" className="text-sm font-medium">
          Categoría
        </label>
        <select
          id="categoria"
          name="categoria"
          className="w-full rounded-md border px-3 py-2"
          defaultValue={getValue(defaultValues, "categoria")}
          disabled={!hasCategories}
          required
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
          Unidad de medida
        </label>
        <select
          id="unidad_medida"
          name="unidad_medida"
          className="w-full rounded-md border px-3 py-2"
          defaultValue={getValue(defaultValues, "unidad_medida") || "unidad"}
          required
        >
          {unitOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
          step="0.01"
          min="0"
          placeholder="Ejemplo: 35.00"
          className="w-full rounded-md border px-3 py-2"
          defaultValue={getValue(defaultValues, "precio_referencial")}
        />
        <p className="text-xs text-muted-foreground">
          Este precio es referencial. Más adelante se calculará mejor con el
          módulo de costos.
        </p>
        <FieldError messages={state.fieldErrors?.precio_referencial} />
      </div>

      <div className="space-y-2">
        <label htmlFor="descripcion" className="text-sm font-medium">
          Descripción
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          placeholder="Describe características principales del producto."
          className="min-h-24 w-full rounded-md border px-3 py-2"
          defaultValue={getValue(defaultValues, "descripcion")}
        />
        <FieldError messages={state.fieldErrors?.descripcion} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending || !hasCategories}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Guardando..." : submitLabel}
        </button>

        <Link
          href="/dashboard/commercial/products"
          className="rounded-md border px-4 py-2 text-sm font-medium"
        >
          Volver a productos
        </Link>
      </div>
    </form>
  );
}
