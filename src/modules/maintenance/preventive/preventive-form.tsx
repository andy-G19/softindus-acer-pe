"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useMemo, useState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field, FieldError } from "@/components/forms/field";
import { useFormResult, useFormSurface } from "@/components/forms/form-surface";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { hasListFilters } from "@/lib/navigation";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { PreventiveFormState, PreventiveFormValues } from "@/modules/maintenance/preventive/actions";

type MachineOption = {
  id: string;
  label: string;
  description?: string;
};

type PreventiveFormProps = {
  action: (prevState: PreventiveFormState, formData: FormData) => Promise<PreventiveFormState>;
  machines: MachineOption[];
  /** Valores iniciales: la fecha de hoy y el estado. */
  defaultValues: Partial<PreventiveFormValues>;
  /**
   * Aviso que se da al guardar, del catalogo de Mantenimiento. La pagina lo
   * pasa con su clave literal
   * (maintenanceNotifications["preventive-maintenance-created"]) para que
   * notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: PreventiveFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const emptyValues: PreventiveFormValues = {
  id_maquina: "",
  fecha_programada: "",
  estado: "",
  responsable: "",
  actividad: "",
  observaciones: "",
};

// Formulario de alta de mantenimientos preventivos (entrega 10.5b), con el
// patron de Fallas: la accion devuelve un resultado; con error, ActionForm
// vuelve a mostrar lo enviado y enfoca el primer campo invalido, y el mensaje
// general queda dentro del formulario, sin toast; con exito, se da un solo
// aviso y se vuelve al listado con sus filtros. Los ids son los name de los
// campos. La maquina elegida es estado local porque SearchableSelect con value
// es controlado y ActionForm remonta los campos tras un error.
//
// Dentro de un RouteSheet los campos van en el cuerpo desplazable y los botones
// en el pie fijo; en la pagina completa, Cancelar es un enlace al returnTo. Los
// campos van en columnas segun el ancho del formulario, no de la ventana: el
// panel es angosto aunque la ventana sea ancha.
export function PreventiveForm({ action, machines, defaultValues, successNotification, returnTo }: PreventiveFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedMachine, setSelectedMachine] = useState(defaultValues.id_maquina ?? "");

  const values = state.status === "idle" ? { ...emptyValues, ...defaultValues } : state.values;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const machineErrors = fieldErrors?.id_maquina;

  const notification = useMemo(
    () => (hasListFilters(returnTo) ? { ...successNotification, description: FILTER_HINT } : successNotification),
    [successNotification, returnTo],
  );
  const goBack = useCallback(() => router.push(returnTo), [router, returnTo]);

  // Un aviso por operacion; en el panel lo cierra y en la pagina vuelve al listado.
  useFormResult(state, pending, { successNotification: notification, onSuccess: goBack });

  const resultKey = state.status === "idle" ? undefined : state.operationId;

  const fields = (
    <>
      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <SearchableSelect
          id="id_maquina"
          name="id_maquina"
          label="Maquina"
          placeholder="Buscar maquina..."
          items={machines}
          value={selectedMachine}
          onValueChange={setSelectedMachine}
          required
          emptyMessage="No hay maquinas registradas."
          {...(machineErrors?.length
            ? { "aria-invalid": true as const, "aria-describedby": "id_maquina-error" }
            : {})}
        />
        <FieldError id="id_maquina-error" messages={machineErrors} />
      </div>

      <div className="grid gap-4 @md:grid-cols-3">
        <Field id="fecha_programada" label="Fecha programada" required errors={fieldErrors?.fecha_programada}>
          {(control) => (
            <Input {...control} name="fecha_programada" type="date" defaultValue={values.fecha_programada} />
          )}
        </Field>

        <Field id="estado" label="Estado inicial" required errors={fieldErrors?.estado}>
          {(control) => (
            <NativeSelect {...control} name="estado" defaultValue={values.estado}>
              <option value="pendiente">Pendiente</option>
              <option value="realizado">Realizado</option>
              <option value="vencido">Vencido</option>
              <option value="anulado">Anulado</option>
            </NativeSelect>
          )}
        </Field>

        <Field id="responsable" label="Responsable" errors={fieldErrors?.responsable}>
          {(control) => (
            <Input
              {...control}
              name="responsable"
              type="text"
              placeholder="Ejemplo: Maestro de taller"
              defaultValue={values.responsable}
            />
          )}
        </Field>
      </div>

      <Field id="actividad" label="Actividad preventiva" required errors={fieldErrors?.actividad}>
        {(control) => (
          <Input
            {...control}
            name="actividad"
            type="text"
            placeholder="Ejemplo: Lubricacion general y revision de presion hidraulica"
            defaultValue={values.actividad}
          />
        )}
      </Field>

      <Field id="observaciones" label="Observaciones" errors={fieldErrors?.observaciones}>
        {(control) => (
          <Textarea
            {...control}
            name="observaciones"
            rows={4}
            placeholder="Ejemplo: Revisar mangueras, pernos, fugas y nivel de aceite."
            defaultValue={values.observaciones}
          />
        )}
      </Field>
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
          <SubmitButton pendingText="Guardando...">Programar preventivo</SubmitButton>
        </SheetFooter>
      </ActionForm>
    );
  }

  return (
    <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="@container space-y-4">
      {fields}

      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton pendingText="Guardando...">Programar preventivo</SubmitButton>
        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
