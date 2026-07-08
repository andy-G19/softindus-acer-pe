"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { showError } from "@/lib/notifications";
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
  cancelHref?: string;
  cancelLabel?: string;
  showCancelAction?: boolean;
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
  cancelHref = "/dashboard/staff/operators",
  cancelLabel = "Cancelar",
  showCancelAction = true,
}: OperatorFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.error) {
      showError(
        "No se pudo completar la operación",
        "Revise los datos ingresados e inténtelo nuevamente.",
      );
    }
  }, [state.error]);

  return (
    <form action={formAction} className="space-y-4">
      {defaultValues?.id_operario ? (
        <input type="hidden" name="id_operario" value={defaultValues.id_operario} />
      ) : null}

      {state.error ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nombres">Nombres</Label>
          <Input
            id="nombres"
            name="nombres"
            required
            defaultValue={getValue(defaultValues, "nombres")}
          />
          <FieldError messages={state.fieldErrors?.nombres} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="apellidos">Apellidos</Label>
          <Input
            id="apellidos"
            name="apellidos"
            required
            defaultValue={getValue(defaultValues, "apellidos")}
          />
          <FieldError messages={state.fieldErrors?.apellidos} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cargo">Cargo</Label>
          <Input
            id="cargo"
            name="cargo"
            defaultValue={getValue(defaultValues, "cargo")}
          />
          <FieldError messages={state.fieldErrors?.cargo} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="especialidad">Especialidad</Label>
          <Input
            id="especialidad"
            name="especialidad"
            defaultValue={getValue(defaultValues, "especialidad")}
          />
          <FieldError messages={state.fieldErrors?.especialidad} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="telefono">Telefono</Label>
          <Input
            id="telefono"
            name="telefono"
            defaultValue={getValue(defaultValues, "telefono")}
          />
          <FieldError messages={state.fieldErrors?.telefono} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fecha_ingreso">Fecha de ingreso</Label>
          <Input
            id="fecha_ingreso"
            name="fecha_ingreso"
            type="date"
            defaultValue={getValue(defaultValues, "fecha_ingreso")}
          />
          <FieldError messages={state.fieldErrors?.fecha_ingreso} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="direccion">Direccion</Label>
        <Input
          id="direccion"
          name="direccion"
          defaultValue={getValue(defaultValues, "direccion")}
        />
        <FieldError messages={state.fieldErrors?.direccion} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="modalidad_pago">Modalidad de pago</Label>
          <NativeSelect
            id="modalidad_pago"
            name="modalidad_pago"
            required
            defaultValue={getValue(defaultValues, "modalidad_pago") || "semanal"}
          >
            <option value="semanal">Semanal</option>
            <option value="quincenal">Quincenal</option>
            <option value="mensual">Mensual</option>
          </NativeSelect>
          <FieldError messages={state.fieldErrors?.modalidad_pago} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tarifa">Tarifa</Label>
          <Input
            id="tarifa"
            name="tarifa"
            type="number"
            min="0"
            step="0.01"
            defaultValue={getValue(defaultValues, "tarifa")}
          />
          <FieldError messages={state.fieldErrors?.tarifa} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="estado">Estado</Label>
          <NativeSelect
            id="estado"
            name="estado"
            required
            defaultValue={getValue(defaultValues, "estado") || "activo"}
          >
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </NativeSelect>
          <FieldError messages={state.fieldErrors?.estado} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observaciones">Observaciones</Label>
        <Textarea
          id="observaciones"
          name="observaciones"
          rows={4}
          defaultValue={getValue(defaultValues, "observaciones")}
        />
        <FieldError messages={state.fieldErrors?.observaciones} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={isPending}>
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
