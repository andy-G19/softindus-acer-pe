"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { OperatorFormState } from "@/modules/staff/operators/actions";

type OperatorFormValues = {
  id_operario?: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  especialidad: string;
  telefono: string;
  direccion: string;
  modalidad_pago: string;
  tarifa: string;
  fecha_ingreso: string;
  estado: string;
  observaciones: string;
};

type OperatorFormProps = {
  action: (
    prevState: OperatorFormState,
    formData: FormData,
  ) => Promise<OperatorFormState>;
  defaultValues?: Partial<OperatorFormValues>;
  submitLabel: string;
};

const initialState: OperatorFormState = { error: "" };

function getValue(
  defaultValues: Partial<OperatorFormValues> | undefined,
  field: keyof OperatorFormValues,
) {
  return defaultValues?.[field] ?? "";
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function OperatorForm({
  action,
  defaultValues,
  submitLabel,
}: OperatorFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {defaultValues?.id_operario ? (
        <input type="hidden" name="id_operario" value={defaultValues.id_operario} />
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
          <label htmlFor="nombres" className="text-sm font-medium">
            Nombres
          </label>
          <input
            id="nombres"
            name="nombres"
            required
            defaultValue={getValue(defaultValues, "nombres")}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.nombres} />
        </div>

        <div className="space-y-2">
          <label htmlFor="apellidos" className="text-sm font-medium">
            Apellidos
          </label>
          <input
            id="apellidos"
            name="apellidos"
            required
            defaultValue={getValue(defaultValues, "apellidos")}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.apellidos} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="cargo" className="text-sm font-medium">
            Cargo
          </label>
          <input
            id="cargo"
            name="cargo"
            defaultValue={getValue(defaultValues, "cargo")}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.cargo} />
        </div>

        <div className="space-y-2">
          <label htmlFor="especialidad" className="text-sm font-medium">
            Especialidad
          </label>
          <input
            id="especialidad"
            name="especialidad"
            defaultValue={getValue(defaultValues, "especialidad")}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.especialidad} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="telefono" className="text-sm font-medium">
            Telefono
          </label>
          <input
            id="telefono"
            name="telefono"
            defaultValue={getValue(defaultValues, "telefono")}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.telefono} />
        </div>

        <div className="space-y-2">
          <label htmlFor="fecha_ingreso" className="text-sm font-medium">
            Fecha de ingreso
          </label>
          <input
            id="fecha_ingreso"
            name="fecha_ingreso"
            type="date"
            defaultValue={getValue(defaultValues, "fecha_ingreso")}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.fecha_ingreso} />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="direccion" className="text-sm font-medium">
          Direccion
        </label>
        <input
          id="direccion"
          name="direccion"
          defaultValue={getValue(defaultValues, "direccion")}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
        <FieldError messages={state.fieldErrors?.direccion} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="modalidad_pago" className="text-sm font-medium">
            Modalidad de pago
          </label>
          <select
            id="modalidad_pago"
            name="modalidad_pago"
            required
            defaultValue={getValue(defaultValues, "modalidad_pago") || "semanal"}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="semanal">Semanal</option>
            <option value="quincenal">Quincenal</option>
            <option value="mensual">Mensual</option>
          </select>
          <FieldError messages={state.fieldErrors?.modalidad_pago} />
        </div>

        <div className="space-y-2">
          <label htmlFor="tarifa" className="text-sm font-medium">
            Tarifa
          </label>
          <input
            id="tarifa"
            name="tarifa"
            type="number"
            min="0"
            step="0.01"
            defaultValue={getValue(defaultValues, "tarifa")}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <FieldError messages={state.fieldErrors?.tarifa} />
        </div>

        <div className="space-y-2">
          <label htmlFor="estado" className="text-sm font-medium">
            Estado
          </label>
          <select
            id="estado"
            name="estado"
            required
            defaultValue={getValue(defaultValues, "estado") || "activo"}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
          <FieldError messages={state.fieldErrors?.estado} />
        </div>
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
          href="/dashboard/staff/operators"
          className="rounded-md border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
        >
          Volver al listado
        </Link>
      </div>
    </form>
  );
}
