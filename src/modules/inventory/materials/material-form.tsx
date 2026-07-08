"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { showError } from "@/lib/notifications";
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
  cancelHref?: string;
  cancelLabel?: string;
  showCancelAction?: boolean;
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

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function MaterialForm({
  action,
  categories,
  defaultValues,
  submitLabel,
  mode,
  cancelHref = "/dashboard/inventory/materials",
  cancelLabel = "Cancelar",
  showCancelAction = true,
}: MaterialFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const hasCategories = categories.length > 0;

  useEffect(() => {
    if (state.error) {
      showError(
        "No se pudo completar la operación",
        "Revise los datos ingresados e inténtelo nuevamente.",
      );
    }
  }, [state.error]);

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
    >
      {defaultValues?.id_material ? (
        <input
          type="hidden"
          name="id_material"
          value={defaultValues.id_material}
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
            No hay categorías de materiales activas.{" "}
            <Link href="/dashboard/inventory/material-categories">
              Crear categorías de materiales
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="nombre_material">Nombre del material *</Label>
        <Input
          id="nombre_material"
          name="nombre_material"
          required
          placeholder="Ej. Plancha metálica 1/20"
          defaultValue={getValue(defaultValues, "nombre_material")}
        />
        <FieldError messages={state.fieldErrors?.nombre_material} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="categoria">Categoría *</Label>
          <NativeSelect
            id="categoria"
            name="categoria"
            required
            disabled={!hasCategories}
            defaultValue={getValue(defaultValues, "categoria")}
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
          <Label htmlFor="unidad_medida">Unidad de medida *</Label>
          <Input
            id="unidad_medida"
            name="unidad_medida"
            required
            placeholder="Ej. kg, unidad, metro, plancha"
            defaultValue={getValue(defaultValues, "unidad_medida")}
          />
          <FieldError messages={state.fieldErrors?.unidad_medida} />
        </div>
      </div>

      {mode === "create" ? (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="stock_actual">Stock actual *</Label>
            <Input
              id="stock_actual"
              name="stock_actual"
              type="number"
              step="0.01"
              min="0"
              defaultValue={getValue(defaultValues, "stock_actual") || "0"}
              required
            />
            <FieldError messages={state.fieldErrors?.stock_actual} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock_reservado">Stock reservado *</Label>
            <Input
              id="stock_reservado"
              name="stock_reservado"
              type="number"
              step="0.01"
              min="0"
              defaultValue={getValue(defaultValues, "stock_reservado") || "0"}
              required
            />
            <FieldError messages={state.fieldErrors?.stock_reservado} />
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <span className="text-sm font-medium">Stock actual</span>
            <div className="flex h-8 items-center rounded-lg border border-input bg-muted px-2.5 text-sm">
              {getValue(defaultValues, "stock_actual") || "0.00"}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Stock reservado</span>
            <div className="flex h-8 items-center rounded-lg border border-input bg-muted px-2.5 text-sm">
              {getValue(defaultValues, "stock_reservado") || "0.00"}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="stock_minimo">Stock mínimo *</Label>
          <Input
            id="stock_minimo"
            name="stock_minimo"
            type="number"
            step="0.01"
            min="0"
            defaultValue={getValue(defaultValues, "stock_minimo") || "0"}
            required
          />
          <FieldError messages={state.fieldErrors?.stock_minimo} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="costo_unitario_actual">Costo unitario actual *</Label>
          <Input
            id="costo_unitario_actual"
            name="costo_unitario_actual"
            type="number"
            step="0.01"
            min="0"
            defaultValue={
              getValue(defaultValues, "costo_unitario_actual") || "0"
            }
            required
          />
          <FieldError messages={state.fieldErrors?.costo_unitario_actual} />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        {showCancelAction ? (
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href={cancelHref}>{cancelLabel}</Link>
          </Button>
        ) : (
          <span />
        )}

        <Button type="submit" disabled={isPending || !hasCategories}>
          {isPending ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
