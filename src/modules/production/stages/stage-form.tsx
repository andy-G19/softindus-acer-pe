"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { useFormResult, useFormSurface } from "@/components/forms/form-surface";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { hasListFilters } from "@/lib/navigation";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import {
  STAGE_TIME_MODES,
  STAGE_TIME_MODE_DESCRIPTIONS,
  getStageWorkload,
} from "@/lib/production-times";
import type { RouteStageFormState, RouteStageFormValues } from "@/modules/production/stages/actions";

type MachineOption = {
  id_maquina: string;
  nombre: string;
  tipo: string;
  estado: string;
};

type StageFormValues = RouteStageFormValues & {
  id_etapa_ruta?: string;
  tiempo_operario_minutos_unidad: string;
  id_maquina: string;
  tiempo_maquina_minutos_unidad: string;
  modo_tiempo: string;
  requiere_maquina: boolean;
};

type StageFormProps = {
  action: (prevState: RouteStageFormState, formData: FormData) => Promise<RouteStageFormState>;
  routeId: string;
  machines: MachineOption[];
  defaultValues?: Partial<StageFormValues>;
  submitLabel: string;
  /**
   * Aviso que se da al guardar, del catalogo de Produccion. La pagina lo pasa
   * con su clave literal (productionNotifications["route-stage-created"]) para
   * que notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
  /** Avisos de la etapa o la ruta: van dentro del formulario para verse tambien en el panel. */
  notices?: ReactNode;
  disabled?: boolean;
};

const initialState: RouteStageFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const emptyValues: RouteStageFormValues = {
  nombre_etapa: "",
  orden_secuencia: "",
  descripcion: "",
};

/** Cantidad de ejemplo para la vista previa de carga de trabajo. */
const PREVIEW_QUANTITY = 10;

// Formulario de alta y edicion de etapas (entrega 10.6a), con el patron de
// Productos. La accion devuelve un resultado: con error, ActionForm vuelve a
// mostrar lo enviado y enfoca el primer campo invalido, y el mensaje queda dentro
// del formulario, sin el toast que antes lo duplicaba; con exito, se da un solo
// aviso y se vuelve al listado con sus filtros.
//
// Los tiempos, la maquina y el modo son estado del formulario: mueven la vista
// previa y sobreviven al remontaje de los campos. El select de maquina usa
// defaultValue y no value: React reinicia el formulario tras la accion, y un
// select controlado no tiene opcion por defecto, asi que volvia a «Sin maquina»
// mientras el estado seguia con la maquina.
//
// El panel cuenta como cambio cada evento input. El interruptor del modo no
// dispara ninguno, asi que lo hace su campo oculto, como SearchableSelect.
//
// Dentro de un RouteSheet los campos van en el cuerpo desplazable y los botones
// en el pie fijo; en la pagina completa, Cancelar es un enlace al returnTo. Las
// parejas de campos van en dos columnas segun el ancho del formulario, no de la
// ventana: el panel es angosto aunque la ventana sea ancha.
export function StageForm({
  action,
  routeId,
  machines,
  defaultValues,
  submitLabel,
  successNotification,
  returnTo,
  notices,
  disabled = false,
}: StageFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);
  const modeRef = useRef<HTMLInputElement>(null);

  const [operatorMinutes, setOperatorMinutes] = useState(defaultValues?.tiempo_operario_minutos_unidad ?? "");
  const [machineId, setMachineId] = useState(defaultValues?.id_maquina ?? "");
  const [machineMinutes, setMachineMinutes] = useState(defaultValues?.tiempo_maquina_minutos_unidad ?? "");
  const [isSimultaneous, setIsSimultaneous] = useState(
    (defaultValues?.modo_tiempo ?? STAGE_TIME_MODES.SIMULTANEO) !== STAGE_TIME_MODES.SECUENCIAL,
  );
  const [requiresMachine, setRequiresMachine] = useState(defaultValues?.requiere_maquina ?? false);

  const values = state.status === "idle" ? { ...emptyValues, ...defaultValues } : state.values;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  const notification = useMemo(
    () => (hasListFilters(returnTo) ? { ...successNotification, description: FILTER_HINT } : successNotification),
    [successNotification, returnTo],
  );
  const goBack = useCallback(() => router.push(returnTo), [router, returnTo]);

  // Un aviso por operacion; en el panel lo cierra y en la pagina vuelve al listado.
  useFormResult(state, pending, { successNotification: notification, onSuccess: goBack });

  const resultKey = state.status === "idle" ? undefined : state.operationId;

  const hasMachine = machineId !== "";
  const mode = isSimultaneous ? STAGE_TIME_MODES.SIMULTANEO : STAGE_TIME_MODES.SECUENCIAL;

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

  function handleModeChange(next: boolean) {
    setIsSimultaneous(next);
    modeRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  const fields = (
    <>
      <input type="hidden" name="id_ruta" value={routeId} />

      {defaultValues?.id_etapa_ruta ? (
        <input type="hidden" name="id_etapa_ruta" value={defaultValues.id_etapa_ruta} />
      ) : null}

      <input ref={modeRef} type="hidden" name="modo_tiempo" value={mode} />

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {notices}

      <Field id="nombre_etapa" label="Nombre de la etapa" required disabled={disabled} errors={fieldErrors?.nombre_etapa}>
        {(control) => (
          <Input
            {...control}
            name="nombre_etapa"
            maxLength={100}
            placeholder="Ej. Corte de plancha"
            defaultValue={values.nombre_etapa}
          />
        )}
      </Field>

      <div className="grid gap-4 @md:grid-cols-2">
        <Field
          id="orden_secuencia"
          label="Orden de ejecución"
          required
          disabled={disabled}
          errors={fieldErrors?.orden_secuencia}
        >
          {(control) => (
            <Input
              {...control}
              name="orden_secuencia"
              type="number"
              min={1}
              max={999}
              defaultValue={values.orden_secuencia}
            />
          )}
        </Field>

        <Field
          id="tiempo_operario_minutos_unidad"
          label="Minutos de operario por unidad"
          description={
            <>
              Minutos que necesita un operario para producir <strong>una</strong> unidad en esta etapa.
            </>
          }
          disabled={disabled}
          errors={fieldErrors?.tiempo_operario_minutos_unidad}
        >
          {(control) => (
            <Input
              {...control}
              name="tiempo_operario_minutos_unidad"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Ej. 8"
              value={operatorMinutes}
              onChange={(event) => setOperatorMinutes(event.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="space-y-5 rounded-lg border border-border/80 bg-secondary/40 p-4">
        <div className="grid gap-4 @md:grid-cols-2">
          <Field
            id="id_maquina"
            label="Máquina utilizada"
            description={
              machines.length === 0
                ? "No hay máquinas registradas. Agrégalas desde el módulo de Mantenimiento."
                : undefined
            }
            disabled={disabled}
            errors={fieldErrors?.id_maquina}
          >
            {(control) => (
              <NativeSelect
                {...control}
                name="id_maquina"
                defaultValue={machineId}
                onChange={(event) => handleMachineChange(event.target.value)}
              >
                <option value="">Sin máquina</option>
                {machines.map((machine) => (
                  <option key={machine.id_maquina} value={machine.id_maquina}>
                    {machine.nombre} · {machine.tipo}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>

          {hasMachine ? (
            <Field
              id="tiempo_maquina_minutos_unidad"
              label="Minutos de máquina por unidad"
              required
              description={
                <>
                  Minutos de uso de la máquina para producir <strong>una</strong> unidad.
                </>
              }
              disabled={disabled}
              errors={fieldErrors?.tiempo_maquina_minutos_unidad}
            >
              {(control) => (
                <Input
                  {...control}
                  name="tiempo_maquina_minutos_unidad"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Ej. 6"
                  value={machineMinutes}
                  onChange={(event) => setMachineMinutes(event.target.value)}
                />
              )}
            </Field>
          ) : null}
        </div>

        {hasMachine ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Switch
                id="modo_tiempo_switch"
                checked={isSimultaneous}
                onCheckedChange={handleModeChange}
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
            <p className="font-medium text-foreground">Para una orden de {PREVIEW_QUANTITY} unidades</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>
                Trabajo de operario:{" "}
                <span className="font-medium text-foreground">{preview.operatorMinutes.toFixed(2)} min</span>
              </li>
              {hasMachine ? (
                <li>
                  Uso de maquinaria:{" "}
                  <span className="font-medium text-foreground">{preview.machineMinutes.toFixed(2)} min</span>
                </li>
              ) : null}
              <li>
                Duración de la etapa:{" "}
                <span className="font-medium text-foreground">{preview.durationMinutes.toFixed(2)} min</span>
              </li>
            </ul>
          </div>
        ) : null}
      </div>

      <Field id="descripcion" label="Descripción técnica" disabled={disabled} errors={fieldErrors?.descripcion}>
        {(control) => (
          <Textarea
            {...control}
            name="descripcion"
            rows={4}
            maxLength={500}
            placeholder="Ej. Se corta la plancha según medida base antes del formado."
            defaultValue={values.descripcion}
          />
        )}
      </Field>

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
          <span className="block font-medium text-foreground">Esta etapa requiere máquina o equipo crítico</span>

          <span className="text-muted-foreground">
            {hasMachine
              ? "Se marca automáticamente porque la etapa ya tiene una máquina asignada."
              : "Márcala para etapas como corte, prensa, soldadura o esmerilado, aunque todavía no asignes la máquina."}
          </span>
        </span>
      </label>
    </>
  );

  if (panel) {
    return (
      <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="@container space-y-4">{fields}</SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={panel.requestClose}>
            Cancelar
          </Button>
          <SubmitButton pendingText="Guardando..." disabled={disabled}>
            {submitLabel}
          </SubmitButton>
        </SheetFooter>
      </ActionForm>
    );
  }

  return (
    <ActionForm
      action={formAction}
      pending={pending}
      resultKey={resultKey}
      className="@container space-y-4 rounded-lg border border-border/80 bg-card p-6"
    >
      {fields}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Guardando..." disabled={disabled}>
          {submitLabel}
        </SubmitButton>

        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
