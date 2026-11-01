"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useState } from "react";

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
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { FailureFormState, FailureFormValues } from "@/modules/maintenance/failures/actions";

type MachineOption = {
  id: string;
  label: string;
  description?: string;
};

type FailureFormProps = {
  action: (prevState: FailureFormState, formData: FormData) => Promise<FailureFormState>;
  machines: MachineOption[];
  /** Valores iniciales: la fecha y hora actuales y el estado. */
  defaultValues: Partial<FailureFormValues>;
  /**
   * Aviso que se da al guardar, del catalogo de Mantenimiento. La pagina lo
   * pasa con su clave literal (maintenanceNotifications["failure-created"])
   * para que notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: FailureFormState = { status: "idle" };

const emptyValues: FailureFormValues = {
  id_maquina: "",
  fecha_falla: "",
  descripcion: "",
  responsable_registro: "",
  estado_atencion: "",
  tiempo_perdido_horas: "",
  impacto_produccion: "",
};

// Formulario de alta de fallas (entrega 10.5b), con el patron de Maquinas y
// Repuestos. La accion devuelve un resultado: con error, ActionForm vuelve a
// mostrar lo enviado y enfoca el primer campo invalido, y el mensaje general
// queda dentro del formulario, sin toast; con exito, se da un solo aviso y se
// vuelve al listado. Los ids son los name de los campos (useId cambiaria con
// los hermanos). La maquina elegida es estado local porque SearchableSelect
// con value es controlado y ActionForm remonta los campos tras un error.
//
// Dentro de un RouteSheet (el panel de las rutas interceptadas) los campos van
// en el cuerpo desplazable y los botones en el pie fijo; Cancelar pide cerrar
// el panel (con confirmacion si hay cambios), guardar lo cierra volviendo atras
// y, mientras la accion esta pendiente, el panel no se cierra. En la pagina
// completa, Cancelar es un enlace al returnTo y guardar navega a el. Las
// parejas de campos van en dos columnas segun el ancho del formulario, no de
// la ventana: el panel es angosto aunque la ventana sea ancha.
export function FailureForm({ action, machines, defaultValues, successNotification, returnTo }: FailureFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedMachine, setSelectedMachine] = useState(defaultValues.id_maquina ?? "");

  const values = state.status === "idle" ? { ...emptyValues, ...defaultValues } : state.values;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const machineErrors = fieldErrors?.id_maquina;

  const goBack = useCallback(() => router.push(returnTo), [router, returnTo]);

  // Un aviso por operacion; en el panel lo cierra y en la pagina vuelve al listado.
  useFormResult(state, pending, { successNotification, onSuccess: goBack });

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

      <div className="grid gap-4 @md:grid-cols-2">
        <Field id="fecha_falla" label="Fecha y hora de falla" required errors={fieldErrors?.fecha_falla}>
          {(control) => (
            <Input {...control} name="fecha_falla" type="datetime-local" defaultValue={values.fecha_falla} />
          )}
        </Field>

        <Field id="estado_atencion" label="Estado de atencion" required errors={fieldErrors?.estado_atencion}>
          {(control) => (
            <NativeSelect {...control} name="estado_atencion" defaultValue={values.estado_atencion}>
              <option value="pendiente">Pendiente</option>
              <option value="en_atencion">En atencion</option>
              <option value="reparada">Reparada</option>
              <option value="anulada">Anulada</option>
            </NativeSelect>
          )}
        </Field>
      </div>

      <Field id="descripcion" label="Descripcion de la falla" required errors={fieldErrors?.descripcion}>
        {(control) => (
          <Textarea
            {...control}
            name="descripcion"
            rows={4}
            placeholder="Ejemplo: La prensa hidraulica perdio presion durante el proceso de doblado."
            defaultValue={values.descripcion}
          />
        )}
      </Field>

      <div className="grid gap-4 @md:grid-cols-2">
        <Field id="responsable_registro" label="Responsable del registro" errors={fieldErrors?.responsable_registro}>
          {(control) => (
            <Input
              {...control}
              name="responsable_registro"
              type="text"
              placeholder="Ejemplo: Maestro de taller"
              defaultValue={values.responsable_registro}
            />
          )}
        </Field>

        <Field id="tiempo_perdido_horas" label="Tiempo perdido en horas" errors={fieldErrors?.tiempo_perdido_horas}>
          {(control) => (
            <Input
              {...control}
              name="tiempo_perdido_horas"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ejemplo: 2.50"
              defaultValue={values.tiempo_perdido_horas}
            />
          )}
        </Field>
      </div>

      <Field id="impacto_produccion" label="Impacto en produccion" errors={fieldErrors?.impacto_produccion}>
        {(control) => (
          <Textarea
            {...control}
            name="impacto_produccion"
            rows={3}
            placeholder="Ejemplo: Se detuvo el doblado de piezas durante la tarde."
            defaultValue={values.impacto_produccion}
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
          <SubmitButton pendingText="Guardando...">Registrar falla</SubmitButton>
        </SheetFooter>
      </ActionForm>
    );
  }

  return (
    <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="@container space-y-4">
      {fields}

      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton pendingText="Guardando...">Registrar falla</SubmitButton>
        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
