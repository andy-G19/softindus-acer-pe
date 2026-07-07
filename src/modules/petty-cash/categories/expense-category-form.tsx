"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ExpenseCategoryFormState } from "@/modules/petty-cash/categories/actions";

type ExpenseCategoryValues = {
  id_categoria_gasto?: string;
  nombre_categoria: string;
  descripcion: string;
  estado: string;
};

type ExpenseCategoryFormProps = {
  action: (
    prevState: ExpenseCategoryFormState,
    formData: FormData,
  ) => Promise<ExpenseCategoryFormState>;
  defaultValues?: Partial<ExpenseCategoryValues>;
  submitLabel: string;
};

const initialState: ExpenseCategoryFormState = { error: "" };

function getValue(
  defaultValues: Partial<ExpenseCategoryValues> | undefined,
  field: keyof ExpenseCategoryValues,
) {
  return defaultValues?.[field] ?? "";
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function ExpenseCategoryForm({
  action,
  defaultValues,
  submitLabel,
}: ExpenseCategoryFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {defaultValues?.id_categoria_gasto ? (
        <input
          type="hidden"
          name="id_categoria_gasto"
          value={defaultValues.id_categoria_gasto}
        />
      ) : null}

      {state.error ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="nombre_categoria">Nombre de categoría</Label>
        <Input
          id="nombre_categoria"
          name="nombre_categoria"
          required
          defaultValue={getValue(defaultValues, "nombre_categoria")}
        />
        <FieldError messages={state.fieldErrors?.nombre_categoria} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          rows={4}
          defaultValue={getValue(defaultValues, "descripcion")}
        />
        <FieldError messages={state.fieldErrors?.descripcion} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="estado">Estado</Label>
        <NativeSelect
          id="estado"
          name="estado"
          defaultValue={getValue(defaultValues, "estado") || "true"}
        >
          <option value="true">Activa</option>
          <option value="false">Inactiva</option>
        </NativeSelect>
        <FieldError messages={state.fieldErrors?.estado} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : submitLabel}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/petty-cash/categories">Volver al listado</Link>
        </Button>
      </div>
    </form>
  );
}
