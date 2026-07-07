"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
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
  cancelHref?: string;
  cancelLabel?: string;
  showCancelAction?: boolean;
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
  cancelHref = "/dashboard/commercial/products",
  cancelLabel = "Cancelar",
  showCancelAction = true,
}: ProductFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const hasCategories = categories.length > 0;

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-lg border border-border/80 bg-card p-6"
    >
      {defaultValues?.id_producto ? (
        <input
          type="hidden"
          name="id_producto"
          value={defaultValues.id_producto}
        />
      ) : null}

      {state.error ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {!hasCategories ? (
        <Alert variant="info">
          <AlertDescription>
            No hay categorías activas disponibles.{" "}
            <Link href="/dashboard/commercial/product-categories">
              Crear categorías de productos
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="nombre_producto">Nombre del producto</Label>
        <Input
          id="nombre_producto"
          name="nombre_producto"
          placeholder="Ejemplo: Lampa agrícola reforzada"
          defaultValue={getValue(defaultValues, "nombre_producto")}
          required
        />
        <FieldError messages={state.fieldErrors?.nombre_producto} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="categoria">Categoría</Label>
        <NativeSelect
          id="categoria"
          name="categoria"
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
        </NativeSelect>
        <FieldError messages={state.fieldErrors?.categoria} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="unidad_medida">Unidad de medida</Label>
        <NativeSelect
          id="unidad_medida"
          name="unidad_medida"
          defaultValue={getValue(defaultValues, "unidad_medida") || "unidad"}
          required
        >
          {unitOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
        <FieldError messages={state.fieldErrors?.unidad_medida} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="precio_referencial">Precio referencial</Label>
        <Input
          id="precio_referencial"
          name="precio_referencial"
          type="number"
          step="0.01"
          min="0"
          placeholder="Ejemplo: 35.00"
          defaultValue={getValue(defaultValues, "precio_referencial")}
        />
        <p className="text-xs text-muted-foreground">
          Este precio es referencial. Más adelante se calculará mejor con el
          módulo de costos.
        </p>
        <FieldError messages={state.fieldErrors?.precio_referencial} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          placeholder="Describe características principales del producto."
          className="min-h-24"
          defaultValue={getValue(defaultValues, "descripcion")}
        />
        <FieldError messages={state.fieldErrors?.descripcion} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending || !hasCategories}>
          {isPending ? "Guardando..." : submitLabel}
        </Button>

        {showCancelAction ? (
          <Button variant="outline" asChild>
            <Link href={cancelHref}>{cancelLabel}</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
