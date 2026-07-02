"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { MachineFormState } from "@/modules/maintenance/machines/actions";

type MachineFormValues = {
  id_maquina?: string;
  nombre: string;
  tipo: string;
  codigo_interno: string;
  ubicacion: string;
  estado: string;
  observaciones: string;
};

type MachineFormProps = {
  action: (
    prevState: MachineFormState,
    formData: FormData,
  ) => Promise<MachineFormState>;
  defaultValues?: Partial<MachineFormValues>;
  submitLabel: string;
};

const initialState: MachineFormState = { error: "" };

const machineTypes = [
  "prensa",
  "cortadora",
  "soldadora",
  "esmeril",
  "taladro",
  "compresora",
  "dobladora",
  "otro",
];

function getValue(
  defaultValues: Partial<MachineFormValues> | undefined,
  field: keyof MachineFormValues,
) {
  return defaultValues?.[field] ?? "";
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function MachineForm({
  action,
  defaultValues,
  submitLabel,
}: MachineFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {defaultValues?.id_maquina ? (
        <input type="hidden" name="id_maquina" value={defaultValues.id_maquina} />
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="nombre" className="text-sm font-medium">
            Nombre de la maquina
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            defaultValue={getValue(defaultValues, "nombre")}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.nombre} />
        </div>

        <div className="space-y-2">
          <label htmlFor="tipo" className="text-sm font-medium">
            Tipo de maquina
          </label>
          <select
            id="tipo"
            name="tipo"
            required
            defaultValue={getValue(defaultValues, "tipo") || "prensa"}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          >
            {machineTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <FieldError messages={state.fieldErrors?.tipo} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="codigo_interno" className="text-sm font-medium">
            Codigo interno
          </label>
          <input
            id="codigo_interno"
            name="codigo_interno"
            defaultValue={getValue(defaultValues, "codigo_interno")}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.codigo_interno} />
        </div>

        <div className="space-y-2">
          <label htmlFor="ubicacion" className="text-sm font-medium">
            Ubicacion
          </label>
          <input
            id="ubicacion"
            name="ubicacion"
            defaultValue={getValue(defaultValues, "ubicacion")}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.ubicacion} />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="estado" className="text-sm font-medium">
          Estado
        </label>
        <select
          id="estado"
          name="estado"
          required
          defaultValue={getValue(defaultValues, "estado") || "operativa"}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="operativa">Operativa</option>
          <option value="en_reparacion">En mantenimiento</option>
          <option value="dada_de_baja">Fuera de servicio</option>
          <option value="inactiva">Inactiva</option>
        </select>
        <FieldError messages={state.fieldErrors?.estado} />
      </div>

      <div className="space-y-2">
        <label htmlFor="observaciones" className="text-sm font-medium">
          Observaciones
        </label>
        <textarea
          id="observaciones"
          name="observaciones"
          rows={4}
          defaultValue={getValue(defaultValues, "observaciones")}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
        <FieldError messages={state.fieldErrors?.observaciones} />
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
          href="/dashboard/maintenance/machines"
          className="rounded-md border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
        >
          Volver al listado
        </Link>
      </div>
    </form>
  );
}
