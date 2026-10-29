"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useMemo } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { useFormResult, useFormSurface } from "@/components/forms/form-surface";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { hasListFilters } from "@/lib/navigation";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { MachineFormState, MachineFormValues } from "@/modules/maintenance/machines/actions";

type MachineFormProps = {
  action: (prevState: MachineFormState, formData: FormData) => Promise<MachineFormState>;
  /** Valores de la maquina que se edita; en el alta, el tipo y el estado iniciales. */
  defaultValues?: Partial<MachineFormValues> & { id_maquina?: string };
  submitLabel: string;
  /**
   * Aviso que se da al guardar, del catalogo de Mantenimiento. La pagina lo
   * pasa con su clave literal (maintenanceNotifications["machine-created"])
   * para que notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: MachineFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const emptyValues: MachineFormValues = {
  nombre: "",
  tipo: "",
  codigo_interno: "",
  ubicacion: "",
  estado: "",
  observaciones: "",
};

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

// Formulario de alta y edicion de maquinas (entrega 10.5a), con el patron de
// Productos y Proveedores. La accion devuelve un resultado: con error,
// ActionForm vuelve a mostrar lo enviado y enfoca el primer campo invalido, y
// el mensaje general queda dentro del formulario, sin toast; con exito, se da
// un solo aviso y se vuelve al listado con sus filtros. Los ids son los name de
// los campos (useId cambiaria con los hermanos).
//
// Dentro de un RouteSheet (el panel de las rutas interceptadas) los campos van
// en el cuerpo desplazable y los botones en el pie fijo; Cancelar pide cerrar
// el panel (con confirmacion si hay cambios), guardar lo cierra volviendo atras
// y, mientras la accion esta pendiente, el panel no se cierra. En la pagina
// completa, Cancelar es un enlace al returnTo y guardar navega a el. Las
// parejas de campos van en dos columnas segun el ancho del formulario, no de
// la ventana: el panel es angosto aunque la ventana sea ancha.
export function MachineForm({ action, defaultValues, submitLabel, successNotification, returnTo }: MachineFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);

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

  const fields = (
    <>
      {defaultValues?.id_maquina ? (
        <input type="hidden" name="id_maquina" value={defaultValues.id_maquina} />
      ) : null}

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 @md:grid-cols-2">
        <Field id="nombre" label="Nombre de la maquina" required errors={fieldErrors?.nombre}>
          {(control) => <Input {...control} name="nombre" defaultValue={values.nombre} />}
        </Field>

        <Field id="tipo" label="Tipo de maquina" required errors={fieldErrors?.tipo}>
          {(control) => (
            <NativeSelect {...control} name="tipo" defaultValue={values.tipo || "prensa"}>
              {machineTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>

      <div className="grid gap-4 @md:grid-cols-2">
        <Field id="codigo_interno" label="Codigo interno" errors={fieldErrors?.codigo_interno}>
          {(control) => <Input {...control} name="codigo_interno" defaultValue={values.codigo_interno} />}
        </Field>

        <Field id="ubicacion" label="Ubicacion" errors={fieldErrors?.ubicacion}>
          {(control) => <Input {...control} name="ubicacion" defaultValue={values.ubicacion} />}
        </Field>
      </div>

      <Field id="estado" label="Estado" required errors={fieldErrors?.estado}>
        {(control) => (
          <NativeSelect {...control} name="estado" defaultValue={values.estado || "operativa"}>
            <option value="operativa">Operativa</option>
            <option value="en_reparacion">En mantenimiento</option>
            <option value="dada_de_baja">Fuera de servicio</option>
            <option value="inactiva">Inactiva</option>
          </NativeSelect>
        )}
      </Field>

      <Field id="observaciones" label="Observaciones" errors={fieldErrors?.observaciones}>
        {(control) => <Textarea {...control} name="observaciones" rows={4} defaultValue={values.observaciones} />}
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
          <SubmitButton pendingText="Guardando...">{submitLabel}</SubmitButton>
        </SheetFooter>
      </ActionForm>
    );
  }

  return (
    <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="@container space-y-4">
      {fields}

      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton pendingText="Guardando...">{submitLabel}</SubmitButton>
        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
