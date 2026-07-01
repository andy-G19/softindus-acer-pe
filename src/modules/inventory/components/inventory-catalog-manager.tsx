"use client";

import { useActionState } from "react";

type CatalogFormState = {
  error: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

type CatalogItem = {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  estado: boolean;
};

type CatalogAction = (
  prevState: CatalogFormState,
  formData: FormData,
) => Promise<CatalogFormState>;

type InventoryCatalogManagerProps = {
  idFieldName: string;
  items: CatalogItem[];
  createAction: CatalogAction;
  updateAction: CatalogAction;
  toggleAction: (formData: FormData) => Promise<void>;
  canManage: boolean;
  createTitle: string;
  emptyMessage: string;
};

const initialState: CatalogFormState = {
  error: "",
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-xs text-red-600">{messages[0]}</p>;
}

function CreateCatalogForm({
  action,
  canManage,
  title,
}: {
  action: CatalogAction;
  canManage: boolean;
  title: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>

      {state.error ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
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
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          disabled={!canManage}
          required
        />
        <FieldError messages={state.fieldErrors?.nombre} />
      </div>

      <div className="space-y-2">
        <label htmlFor="slug" className="text-sm font-medium">
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          placeholder="materia_prima"
          disabled={!canManage}
          required
        />
        <FieldError messages={state.fieldErrors?.slug} />
      </div>

      <div className="space-y-2">
        <label htmlFor="descripcion" className="text-sm font-medium">
          Descripción
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={4}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          disabled={!canManage}
        />
        <FieldError messages={state.fieldErrors?.descripcion} />
      </div>

      <button
        type="submit"
        disabled={!canManage || isPending}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Guardando..." : "Crear"}
      </button>
    </form>
  );
}

function CatalogRow({
  idFieldName,
  item,
  updateAction,
  toggleAction,
  canManage,
}: {
  idFieldName: string;
  item: CatalogItem;
  updateAction: CatalogAction;
  toggleAction: (formData: FormData) => Promise<void>;
  canManage: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    updateAction,
    initialState,
  );

  return (
    <tr className="border-t align-top">
      <td className="px-4 py-3 font-mono text-xs">{item.id}</td>
      <td className="px-4 py-3" colSpan={3}>
        <form action={formAction} className="grid gap-2 md:grid-cols-[1fr_1fr_1.4fr_auto]">
          <input type="hidden" name={idFieldName} value={item.id} />
          <div className="space-y-1">
            <input
              name="nombre"
              defaultValue={item.nombre}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              disabled={!canManage}
              required
            />
            <FieldError messages={state.fieldErrors?.nombre} />
          </div>
          <div className="space-y-1">
            <input
              name="slug"
              defaultValue={item.slug}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              disabled={!canManage}
              required
            />
            <FieldError messages={state.fieldErrors?.slug} />
          </div>
          <div className="space-y-1">
            <textarea
              name="descripcion"
              defaultValue={item.descripcion ?? ""}
              className="min-h-10 w-full rounded-lg border px-3 py-2 text-sm"
              disabled={!canManage}
            />
            <FieldError messages={state.fieldErrors?.descripcion} />
            {state.error ? (
              <p role="alert" className="text-xs text-red-600">
                {state.error}
              </p>
            ) : null}
          </div>
          {canManage ? (
            <button
              type="submit"
              disabled={isPending}
              className="h-9 rounded-md border px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? "Guardando..." : "Editar"}
            </button>
          ) : null}
        </form>
      </td>
      <td className="px-4 py-3">{item.estado ? "Activa" : "Inactiva"}</td>
      <td className="px-4 py-3">
        {canManage ? (
          <form action={toggleAction}>
            <input type="hidden" name={idFieldName} value={item.id} />
            <button
              type="submit"
              className="rounded-md border px-3 py-1.5 text-xs font-medium"
            >
              {item.estado ? "Inactivar" : "Activar"}
            </button>
          </form>
        ) : (
          <span className="text-xs text-slate-500">Solo lectura</span>
        )}
      </td>
    </tr>
  );
}

export function InventoryCatalogManager({
  idFieldName,
  items,
  createAction,
  updateAction,
  toggleAction,
  canManage,
  createTitle,
  emptyMessage,
}: InventoryCatalogManagerProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <CreateCatalogForm
        action={createAction}
        canManage={canManage}
        title={createTitle}
      />

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Slug</th>
              <th className="px-4 py-3 font-semibold">Descripción</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <CatalogRow
                key={item.id}
                idFieldName={idFieldName}
                item={item}
                updateAction={updateAction}
                toggleAction={toggleAction}
                canManage={canManage}
              />
            ))}

            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
