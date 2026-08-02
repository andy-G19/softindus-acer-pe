"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { showError } from "@/lib/notifications";
import {
  STAGE_TIME_MODES,
  STAGE_TIME_MODE_DESCRIPTIONS,
  getStageWorkload,
} from "@/lib/production-times";
import type { RouteStageFormState } from "@/modules/production/stages/actions";

type MachineOption = {
  id_maquina: string;
  nombre: string;
  tipo: string;
  estado: string;
};

type StageFormValues = {
  id_etapa_ruta?: string;
  nombre_etapa: string;
  orden_secuencia: string;
  descripcion: string;
  tiempo_operario_minutos_unidad: string;
  id_maquina: string;
  tiempo_maquina_minutos_unidad: string;
  modo_tiempo: string;
  requiere_maquina: boolean;
};

type StageFormProps = {
  action: (
    prevState: RouteStageFormState,
    formData: FormData,
  ) => Promise<RouteStageFormState>;
  routeId: string;
  machines: MachineOption[];
  defaultValues?: Partial<StageFormValues>;
  submitLabel: string;
  disabled?: boolean;
};

const initialState: RouteStageFormState = { error: "" };

/** Cantidad de ejemplo para la vista previa de carga de trabajo. */
const PREVIEW_QUANTITY = 10;

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function StageForm({
  action,
  routeId,
  machines,
  defaultValues,
  submitLabel,
  disabled = false,
}: StageFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [operatorMinutes, setOperatorMinutes] = useState(
    defaultValues?.tiempo_operario_minutos_unidad ?? "",
  );
  const [machineId, setMachineId] = useState(defaultValues?.id_maquina ?? "");
  const [machineMinutes, setMachineMinutes] = useState(
    defaultValues?.tiempo_maquina_minutos_unidad ?? "",
  );
  const [isSimultaneous, setIsSimultaneous] = useState(
    (defaultValues?.modo_tiempo ?? STAGE_TIME_MODES.SIMULTANEO) !==
      STAGE_TIME_MODES.SECUENCIAL,
  );
  const [requiresMachine, setRequiresMachine] = useState(
    defaultValues?.requiere_maquina ?? false,
  );

  useEffect(() => {
    if (state.error) {
      showError("No se pudo guardar la etapa", state.error);
    }
  }, [state.error]);

  const hasMachine = machineId !== "";
  const mode = isSimultaneous
    ? STAGE_TIME_MODES.SIMULTANEO
    : STAGE_TIME_MODES.SECUENCIAL;

  // Vista previa en vivo: hace tangible la diferencia entre simultáneo y secuencial
  // antes de guardar, que es justo donde se presta a confusión.
  const preview = getStageWorkload({
    operatorMinutes: operatorMinutes,
    machineMinutes: hasMachine ? machineMinutes : null,
    mode,
    quantity: PREVIEW_QUANTITY,
  });

  function handleMachineChange(value: string) {
    setMachineId(value);

    // Sin máquina no puede quedar un tiempo de máquina colgado: el schema lo rechaza.
    if (value === "") {
      setMachineMinutes("");
      return;
    }

    setRequiresMachine(true);
  }

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
    >
      <input type="hidden" name="id_ruta" value={routeId} />

      {defaultValues?.id_etapa_ruta ? (
        <input
          type="hidden"
          name="id_etapa_ruta"
          value={defaultValues.id_etapa_ruta}
        />
      ) : null}

      <input type="hidden" name="modo_tiempo" value={mode} />

      {state.error ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="nombre_etapa">Nombre de la etapa *</Label>
        <Input
          id="nombre_etapa"
          name="nombre_etapa"
          required
          maxLength={100}
          placeholder="Ej. Corte de plancha"
          defaultValue={defaultValues?.nombre_etapa ?? ""}
          disabled={disabled}
        />
        <FieldError messages={state.fieldErrors?.nombre_etapa} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="orden_secuencia">Orden de ejecución *</Label>
          <Input
            id="orden_secuencia"
            name="orden_secuencia"
            type="number"
            min={1}
            max={999}
            required
            defaultValue={defaultValues?.orden_secuencia ?? ""}
            disabled={disabled}
          />
          <FieldError messages={state.fieldErrors?.orden_secuencia} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tiempo_operario_minutos_unidad">
            Minutos de operario por unidad
          </Label>
          <Input
            id="tiempo_operario_minutos_unidad"
            name="tiempo_operario_minutos_unidad"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Ej. 8"
            value={operatorMinutes}
            onChange={(event) => setOperatorMinutes(event.target.value)}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Minutos que necesita un operario para producir <strong>una</strong>{" "}
            unidad en esta etapa.
          </p>
          <FieldError
            messages={state.fieldErrors?.tiempo_operario_minutos_unidad}
          />
        </div>
      </div>

      <div className="space-y-5 rounded-lg border border-border/80 bg-secondary/40 p-4">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="id_maquina">Máquina utilizada</Label>
            <NativeSelect
              id="id_maquina"
              name="id_maquina"
              value={machineId}
              onChange={(event) => handleMachineChange(event.target.value)}
              disabled={disabled}
            >
              <option value="">Sin máquina</option>
              {machines.map((machine) => (
                <option key={machine.id_maquina} value={machine.id_maquina}>
                  {machine.nombre} · {machine.tipo}
                </option>
              ))}
            </NativeSelect>
            {machines.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay máquinas registradas. Agrégalas desde el módulo de
                Mantenimiento.
              </p>
            ) : null}
            <FieldError messages={state.fieldErrors?.id_maquina} />
          </div>

          {hasMachine ? (
            <div className="space-y-2">
              <Label htmlFor="tiempo_maquina_minutos_unidad">
                Minutos de máquina por unidad *
              </Label>
              <Input
                id="tiempo_maquina_minutos_unidad"
                name="tiempo_maquina_minutos_unidad"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Ej. 6"
                value={machineMinutes}
                onChange={(event) => setMachineMinutes(event.target.value)}
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground">
                Minutos de uso de la máquina para producir{" "}
                <strong>una</strong> unidad.
              </p>
              <FieldError
                messages={state.fieldErrors?.tiempo_maquina_minutos_unidad}
              />
            </div>
          ) : null}
        </div>

        {hasMachine ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Switch
                id="modo_tiempo_switch"
                checked={isSimultaneous}
                onCheckedChange={setIsSimultaneous}
                disabled={disabled}
                aria-label="El operario trabaja simultáneamente con la máquina"
              />
              {/* Etiqueta fija: describe qué hace encender el interruptor. Si el texto
                  cambiara con el estado, un interruptor apagado junto a "Trabajo
                  secuencial" se leería como "secuencial: desactivado". */}
              <span className="text-sm font-medium text-foreground">
                El operario trabaja junto a la máquina
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                Modo: {isSimultaneous ? "simultáneo" : "secuencial"}
              </span>{" "}
              —{" "}
              {isSimultaneous
                ? STAGE_TIME_MODE_DESCRIPTIONS.simultaneo
                : STAGE_TIME_MODE_DESCRIPTIONS.secuencial}
            </p>
          </div>
        ) : null}

        {preview.durationMinutes > 0 ? (
          <div className="rounded-lg border border-border/80 bg-card p-3 text-sm">
            <p className="font-medium text-foreground">
              Para una orden de {PREVIEW_QUANTITY} unidades
            </p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>
                Trabajo de operario:{" "}
                <span className="font-medium text-foreground">
                  {preview.operatorMinutes.toFixed(2)} min
                </span>
              </li>
              {hasMachine ? (
                <li>
                  Uso de maquinaria:{" "}
                  <span className="font-medium text-foreground">
                    {preview.machineMinutes.toFixed(2)} min
                  </span>
                </li>
              ) : null}
              <li>
                Duración de la etapa:{" "}
                <span className="font-medium text-foreground">
                  {preview.durationMinutes.toFixed(2)} min
                </span>
              </li>
            </ul>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción técnica</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          rows={4}
          maxLength={500}
          placeholder="Ej. Se corta la plancha según medida base antes del formado."
          defaultValue={defaultValues?.descripcion ?? ""}
          disabled={disabled}
        />
        <FieldError messages={state.fieldErrors?.descripcion} />
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm">
        <input
          type="checkbox"
          name="requiere_maquina"
          checked={requiresMachine}
          onChange={(event) => setRequiresMachine(event.target.checked)}
          disabled={disabled || hasMachine}
          className="mt-1"
        />

        <span>
          <span className="block font-medium text-foreground">
            Esta etapa requiere máquina o equipo crítico
          </span>

          <span className="text-muted-foreground">
            {hasMachine
              ? "Se marca automáticamente porque la etapa ya tiene una máquina asignada."
              : "Márcala para etapas como corte, prensa, soldadura o esmerilado, aunque todavía no asignes la máquina."}
          </span>
        </span>
      </label>

      <div className="flex items-center justify-between pt-4">
        <Button variant="link" className="h-auto p-0" asChild>
          <Link href={`/dashboard/production/routes/${routeId}/stages`}>
            Volver a etapas
          </Link>
        </Button>

        <Button type="submit" disabled={disabled || isPending}>
          {isPending ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
