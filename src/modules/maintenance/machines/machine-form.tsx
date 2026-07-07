"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
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
  cancelHref?: string;
  cancelLabel?: string;
  showCancelAction?: boolean;
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
  cancelHref = "/dashboard/maintenance/machines",
  cancelLabel = "Cancelar",
  showCancelAction = true,
}: MachineFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {defaultValues?.id_maquina ? (
        <input type="hidden" name="id_maquina" value={defaultValues.id_maquina} />
      ) : null}

      {state.error ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre de la maquina</Label>
          <Input
            id="nombre"
            name="nombre"
            required
            defaultValue={getValue(defaultValues, "nombre")}
          />
          <FieldError messages={state.fieldErrors?.nombre} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo de maquina</Label>
          <NativeSelect
            id="tipo"
            name="tipo"
            required
            defaultValue={getValue(defaultValues, "tipo") || "prensa"}
          >
            {machineTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </NativeSelect>
          <FieldError messages={state.fieldErrors?.tipo} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="codigo_interno">Codigo interno</Label>
          <Input
            id="codigo_interno"
            name="codigo_interno"
            defaultValue={getValue(defaultValues, "codigo_interno")}
          />
          <FieldError messages={state.fieldErrors?.codigo_interno} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ubicacion">Ubicacion</Label>
          <Input
            id="ubicacion"
            name="ubicacion"
            defaultValue={getValue(defaultValues, "ubicacion")}
          />
          <FieldError messages={state.fieldErrors?.ubicacion} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="estado">Estado</Label>
        <NativeSelect
          id="estado"
          name="estado"
          required
          defaultValue={getValue(defaultValues, "estado") || "operativa"}
        >
          <option value="operativa">Operativa</option>
          <option value="en_reparacion">En mantenimiento</option>
          <option value="dada_de_baja">Fuera de servicio</option>
          <option value="inactiva">Inactiva</option>
        </NativeSelect>
        <FieldError messages={state.fieldErrors?.estado} />
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
