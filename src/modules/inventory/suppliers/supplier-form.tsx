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
import type { SupplierFormState, SupplierFormValues } from "@/modules/inventory/suppliers/actions";

type SupplierTypeOption = {
  slug: string;
  nombre: string;
};

type SupplierFormProps = {
  action: (prevState: SupplierFormState, formData: FormData) => Promise<SupplierFormState>;
  supplierTypes: SupplierTypeOption[];
  /** Valores del proveedor que se edita; en el alta, vacios. */
  defaultValues?: Partial<SupplierFormValues> & { id_proveedor?: string };
  submitLabel: string;
  /**
   * Aviso que se da al guardar, del catalogo de Inventario. La pagina lo pasa
   * con su clave literal (inventoryNotifications["supplier-created"]) para
   * que notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: SupplierFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const emptyValues: SupplierFormValues = {
  razon_social: "",
  tipo_documento: "",
  numero_documento: "",
  telefono: "",
  correo: "",
  direccion: "",
  contacto_principal: "",
  tipo_proveedor: "",
  condicion_pago: "",
  observaciones: "",
};

// Formulario de alta y edicion de proveedores (entrega 10.3b), con el patron
// de Clientes y Materiales. La accion devuelve un resultado: con error,
// ActionForm vuelve a mostrar lo enviado y enfoca el primer campo invalido, y
// el mensaje general queda dentro del formulario, sin toast; con exito, se da
// un solo aviso y se vuelve al listado con sus filtros. Los ids son los name
// de los campos (useId cambiaria con los hermanos).
//
// Dentro de un RouteSheet (el panel de las rutas interceptadas) los campos van
// en el cuerpo desplazable y los botones en el pie fijo; Cancelar pide cerrar
// el panel (con confirmacion si hay cambios), guardar lo cierra volviendo atras
// y, mientras la accion esta pendiente, el panel no se cierra. En la pagina
// completa, Cancelar es un enlace al returnTo y guardar navega a el.
export function SupplierForm({
  action,
  supplierTypes,
  defaultValues,
  submitLabel,
  successNotification,
  returnTo,
}: SupplierFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);
  const hasSupplierTypes = supplierTypes.length > 0;

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
      {defaultValues?.id_proveedor ? (
        <input type="hidden" name="id_proveedor" value={defaultValues.id_proveedor} />
      ) : null}

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {!hasSupplierTypes ? (
        <Alert variant="info">
          <AlertDescription>
            No hay tipos de proveedor activos.{" "}
            <Link href="/dashboard/inventory/supplier-types">Crear tipos de proveedor</Link>.
          </AlertDescription>
        </Alert>
      ) : null}

      <Field id="razon_social" label="Razón social" required errors={fieldErrors?.razon_social}>
        {(control) => (
          <Input
            {...control}
            name="razon_social"
            placeholder="Ej. Aceros del Sur S.A.C."
            defaultValue={values.razon_social}
          />
        )}
      </Field>

      <div className="grid gap-4 @md:grid-cols-2">
        <Field id="tipo_documento" label="Tipo de documento" errors={fieldErrors?.tipo_documento}>
          {(control) => (
            <NativeSelect {...control} name="tipo_documento" defaultValue={values.tipo_documento}>
              <option value="">Sin documento</option>
              <option value="ruc">RUC</option>
              <option value="dni">DNI</option>
              <option value="otro">Otro</option>
            </NativeSelect>
          )}
        </Field>

        <Field id="numero_documento" label="Número de documento" errors={fieldErrors?.numero_documento}>
          {(control) => (
            <Input
              {...control}
              name="numero_documento"
              placeholder="Ej. 20601234567"
              defaultValue={values.numero_documento}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 @md:grid-cols-2">
        <Field id="telefono" label="Teléfono" errors={fieldErrors?.telefono}>
          {(control) => (
            <Input {...control} name="telefono" placeholder="Ej. 999 888 777" defaultValue={values.telefono} />
          )}
        </Field>

        <Field id="correo" label="Correo" errors={fieldErrors?.correo}>
          {(control) => (
            <Input
              {...control}
              name="correo"
              type="email"
              placeholder="proveedor@correo.com"
              defaultValue={values.correo}
            />
          )}
        </Field>
      </div>

      <Field id="direccion" label="Dirección" errors={fieldErrors?.direccion}>
        {(control) => (
          <Input {...control} name="direccion" placeholder="Dirección comercial" defaultValue={values.direccion} />
        )}
      </Field>

      <div className="grid gap-4 @md:grid-cols-2">
        <Field id="contacto_principal" label="Contacto principal" errors={fieldErrors?.contacto_principal}>
          {(control) => (
            <Input
              {...control}
              name="contacto_principal"
              placeholder="Nombre de la persona de contacto"
              defaultValue={values.contacto_principal}
            />
          )}
        </Field>

        <Field
          id="tipo_proveedor"
          label="Tipo de proveedor"
          required
          disabled={!hasSupplierTypes}
          errors={fieldErrors?.tipo_proveedor}
        >
          {(control) => (
            <NativeSelect {...control} name="tipo_proveedor" defaultValue={values.tipo_proveedor}>
              <option value="">Selecciona un tipo</option>
              {supplierTypes.map((type) => (
                <option key={type.slug} value={type.slug}>
                  {type.nombre}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>

      <Field id="condicion_pago" label="Condición de pago" errors={fieldErrors?.condicion_pago}>
        {(control) => (
          <NativeSelect {...control} name="condicion_pago" defaultValue={values.condicion_pago}>
            <option value="">No especificado</option>
            <option value="contado">Contado</option>
            <option value="credito">Crédito</option>
            <option value="parcial">Parcial</option>
            <option value="otro">Otro</option>
          </NativeSelect>
        )}
      </Field>

      <Field id="observaciones" label="Observaciones" errors={fieldErrors?.observaciones}>
        {(control) => (
          <Textarea
            {...control}
            name="observaciones"
            rows={4}
            placeholder="Notas adicionales sobre el proveedor"
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
          <SubmitButton pendingText="Guardando..." disabled={!hasSupplierTypes}>
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
        <SubmitButton pendingText="Guardando..." disabled={!hasSupplierTypes}>
          {submitLabel}
        </SubmitButton>

        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
