"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { useRouteSheet } from "@/components/navigation/route-sheet";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { hasListFilters } from "@/lib/navigation";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import { notify } from "@/lib/notifications";
import type { ClientFormState, ClientFormValues } from "@/modules/commercial/clients/actions";

type ClientFormProps = {
  action: (prevState: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  /** Valores del cliente que se edita; en el alta, vacios. */
  defaultValues?: Partial<ClientFormValues> & { id_cliente?: string };
  submitLabel: string;
  /**
   * Aviso que se da al guardar, del catalogo de Comercial. La pagina lo pasa
   * con su clave literal (commercialNotifications["client-created"]) para que
   * notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: ClientFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const clientTypeOptions = [
  { value: "cliente_final", label: "Cliente final" },
  { value: "ferreteria", label: "Ferretería" },
  { value: "distribuidora", label: "Distribuidora" },
  { value: "constructora", label: "Constructora" },
  { value: "otro", label: "Otro" },
];

const documentTypeOptions = [
  { value: "", label: "Sin documento" },
  { value: "dni", label: "DNI" },
  { value: "ruc", label: "RUC" },
  { value: "otro", label: "Otro" },
];

const emptyValues: ClientFormValues = {
  tipo_cliente: "cliente_final",
  nombre_razon_social: "",
  tipo_documento: "",
  numero_documento: "",
  telefono: "",
  correo: "",
  direccion: "",
  lugar_origen: "",
  observaciones: "",
};

// Formulario de alta y edicion de clientes (entrega 9). La accion devuelve un
// resultado: con error, ActionForm vuelve a mostrar lo enviado y enfoca el
// primer campo invalido, y el mensaje general queda dentro del formulario, sin
// toast; con exito, se da un solo aviso y se vuelve al listado con sus filtros.
// Los ids son los name de los campos (useId cambiaria con los hermanos).
//
// Dentro de un RouteSheet (el panel de las rutas interceptadas) los campos van
// en el cuerpo desplazable y los botones en el pie fijo; Cancelar pide cerrar
// el panel (con confirmacion si hay cambios), guardar lo cierra volviendo atras
// y, mientras la accion esta pendiente, el panel no se cierra. En la pagina
// completa, Cancelar es un enlace al returnTo y guardar navega a el.
export function ClientForm({ action, defaultValues, submitLabel, successNotification, returnTo }: ClientFormProps) {
  const router = useRouter();
  const panel = useRouteSheet();
  const [state, formAction, pending] = useActionState(action, initialState);

  const values = state.status === "idle" ? { ...emptyValues, ...defaultValues } : state.values;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  useEffect(() => {
    panel?.setBusy(pending);
  }, [panel, pending]);

  // Cada respuesta es un estado nuevo: el aviso sale una vez por operacion. Los
  // controles del panel son estables, asi que no repiten el efecto.
  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    notify(hasListFilters(returnTo) ? { ...successNotification, description: FILTER_HINT } : successNotification);

    if (panel) {
      panel.closeAfterSave();
    } else {
      router.push(returnTo);
    }
  }, [state, successNotification, returnTo, router, panel]);

  const resultKey = state.status === "idle" ? undefined : state.operationId;

  const fields = (
    <>
      {defaultValues?.id_cliente ? (
        <input type="hidden" name="id_cliente" value={defaultValues.id_cliente} />
      ) : null}

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Field id="tipo_cliente" label="Tipo de cliente" required errors={fieldErrors?.tipo_cliente}>
        {(control) => (
          <NativeSelect {...control} name="tipo_cliente" defaultValue={values.tipo_cliente || "cliente_final"}>
            {clientTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field id="nombre_razon_social" label="Nombre o razón social" required errors={fieldErrors?.nombre_razon_social}>
        {(control) => <Input {...control} name="nombre_razon_social" defaultValue={values.nombre_razon_social} />}
      </Field>

      <div className="grid gap-4 @md:grid-cols-2">
        <Field id="tipo_documento" label="Tipo de documento" errors={fieldErrors?.tipo_documento}>
          {(control) => (
            <NativeSelect {...control} name="tipo_documento" defaultValue={values.tipo_documento}>
              {documentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field id="numero_documento" label="Número de documento" errors={fieldErrors?.numero_documento}>
          {(control) => <Input {...control} name="numero_documento" defaultValue={values.numero_documento} />}
        </Field>
      </div>

      <div className="grid gap-4 @md:grid-cols-2">
        <Field id="telefono" label="Teléfono" errors={fieldErrors?.telefono}>
          {(control) => <Input {...control} name="telefono" defaultValue={values.telefono} />}
        </Field>

        <Field id="correo" label="Correo" errors={fieldErrors?.correo}>
          {(control) => <Input {...control} type="email" name="correo" defaultValue={values.correo} />}
        </Field>
      </div>

      <Field id="direccion" label="Dirección" errors={fieldErrors?.direccion}>
        {(control) => <Input {...control} name="direccion" defaultValue={values.direccion} />}
      </Field>

      <Field id="lugar_origen" label="Lugar de origen" errors={fieldErrors?.lugar_origen}>
        {(control) => <Input {...control} name="lugar_origen" defaultValue={values.lugar_origen} />}
      </Field>

      <Field id="observaciones" label="Observaciones" errors={fieldErrors?.observaciones}>
        {(control) => <Textarea {...control} name="observaciones" defaultValue={values.observaciones} />}
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
    <ActionForm
      action={formAction}
      pending={pending}
      resultKey={resultKey}
      className="@container space-y-4 rounded-lg border border-border/80 bg-card p-6"
    >
      {fields}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Guardando...">{submitLabel}</SubmitButton>

        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
