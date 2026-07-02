"use client";

import Link from "next/link";
import { useActionState } from "react";

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
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="nombre_categoria" className="text-sm font-medium">
          Nombre de categoria
        </label>
        <input
          id="nombre_categoria"
          name="nombre_categoria"
          required
          defaultValue={getValue(defaultValues, "nombre_categoria")}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
        <FieldError messages={state.fieldErrors?.nombre_categoria} />
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

      <div className="space-y-2">
        <label htmlFor="estado" className="text-sm font-medium">
          Estado
        </label>
        <select
          id="estado"
          name="estado"
          defaultValue={getValue(defaultValues, "estado") || "true"}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="true">Activa</option>
          <option value="false">Inactiva</option>
        </select>
        <FieldError messages={state.fieldErrors?.estado} />
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
          href="/dashboard/petty-cash/categories"
          className="rounded-md border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
        >
          Volver al listado
        </Link>
      </div>
    </form>
  );
}
