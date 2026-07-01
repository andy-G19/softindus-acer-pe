"use client";

import { useActionState } from "react";

import {
  createProductCategoryAction,
  updateProductCategoryAction,
  type ProductCategoryFormState,
} from "@/modules/commercial/products/actions";

type ProductCategory = {
  id_categoria_producto: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  estado: boolean;
};

type ProductCategoryManagerProps = {
  categories: ProductCategory[];
  canManage: boolean;
  toggleAction: (formData: FormData) => Promise<void>;
};

const initialState: ProductCategoryFormState = {
  error: "",
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

function CategoryCreateForm({ canManage }: { canManage: boolean }) {
  const [state, formAction, isPending] = useActionState(
    createProductCategoryAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4 rounded-lg border p-6">
      <h2 className="text-base font-semibold">Nueva categoría</h2>

      {state.error ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="nombre" className="text-sm font-medium">
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Ejemplo: Herramientas agrícolas"
          disabled={!canManage}
          required
        />
        <FieldError messages={state.fieldErrors?.nombre} />
      </div>

      <div className="space-y-2">
        <label htmlFor="descripcion" className="text-sm font-medium">
          Descripción
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Uso interno de la categoría."
          disabled={!canManage}
        />
        <FieldError messages={state.fieldErrors?.descripcion} />
      </div>

      <button
        type="submit"
        disabled={!canManage || isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Guardando..." : "Crear categoría"}
      </button>
    </form>
  );
}

function CategoryRow({
  category,
  canManage,
  toggleAction,
}: {
  category: ProductCategory;
  canManage: boolean;
  toggleAction: (formData: FormData) => Promise<void>;
}) {
  const [state, formAction, isPending] = useActionState(
    updateProductCategoryAction,
    initialState,
  );

  return (
    <tr className="border-t align-top">
      <td className="px-4 py-3 font-mono text-xs">
        {category.id_categoria_producto}
      </td>
      <td className="px-4 py-3" colSpan={2}>
        <form action={formAction} className="space-y-2">
          <input
            type="hidden"
            name="id_categoria_producto"
            value={category.id_categoria_producto}
          />
          <input
            name="nombre"
            defaultValue={category.nombre}
            className="w-full rounded-md border px-3 py-2 text-sm"
            disabled={!canManage}
            required
          />
          <p className="text-xs text-muted-foreground">{category.slug}</p>
          <FieldError messages={state.fieldErrors?.nombre} />
          <textarea
            name="descripcion"
            defaultValue={category.descripcion ?? ""}
            className="min-h-20 w-full rounded-md border px-3 py-2 text-sm"
            disabled={!canManage}
          />
          <FieldError messages={state.fieldErrors?.descripcion} />
          {state.error ? (
            <p role="alert" className="text-xs text-destructive">
              {state.error}
            </p>
          ) : null}
          {canManage ? (
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? "Guardando..." : "Guardar"}
            </button>
          ) : null}
        </form>
      </td>
      <td className="px-4 py-3">
        {category.estado ? "Activa" : "Inactiva"}
      </td>
      <td className="px-4 py-3">
        {canManage ? (
          <form action={toggleAction}>
            <input
              type="hidden"
              name="id_categoria_producto"
              value={category.id_categoria_producto}
            />
            <button
              type="submit"
              className="rounded-md border px-3 py-1.5 text-xs font-medium"
            >
              {category.estado ? "Inactivar" : "Activar"}
            </button>
          </form>
        ) : (
          <span className="text-xs text-muted-foreground">Solo lectura</span>
        )}
      </td>
    </tr>
  );
}

export function ProductCategoryManager({
  categories,
  canManage,
  toggleAction,
}: ProductCategoryManagerProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <CategoryCreateForm canManage={canManage} />

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-left">Descripción</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <CategoryRow
                key={category.id_categoria_producto}
                category={category}
                canManage={canManage}
                toggleAction={toggleAction}
              />
            ))}

            {categories.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  Todavía no hay categorías de productos registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
