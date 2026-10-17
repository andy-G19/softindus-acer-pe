"use client";

import { useActionState, type ReactElement } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { useFormResult, useFormSurface } from "@/components/forms/form-surface";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { InventoryCatalogFormState } from "@/modules/inventory/catalog-form-state";

type CatalogAction = (prevState: InventoryCatalogFormState, formData: FormData) => Promise<InventoryCatalogFormState>;

export type InventoryCatalogItem = {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
};

type InventoryCatalogDialogProps = {
  action: CatalogAction;
  /** Nombre del campo del id en la accion (id_tipo_proveedor, id_categoria_material). */
  idFieldName: string;
  /** Registro que se edita; sin el es un alta. */
  item?: InventoryCatalogItem;
  title: string;
  submitLabel: string;
  /** Aviso del catalogo de Inventario; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
  /** Pregunta de la confirmacion de descarte, con la entidad. */
  discardTitle: string;
  /** Boton que abre la ventana (Radix le devuelve el foco al cerrarla). */
  trigger: ReactElement;
};

const initialState: InventoryCatalogFormState = { status: "idle" };

// Formulario de la ventana. Se monta cada vez que se abre: empieza sin estado.
function CatalogForm({
  action,
  idFieldName,
  item,
  submitLabel,
  successNotification,
}: Omit<InventoryCatalogDialogProps, "title" | "trigger" | "discardTitle">) {
  const surface = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);

  const values =
    state.status === "idle"
      ? { nombre: item?.nombre ?? "", slug: item?.slug ?? "", descripcion: item?.descripcion ?? "" }
      : state.values;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  // Un aviso por operacion; al guardar se cierra la ventana.
  useFormResult(state, pending, { successNotification });

  return (
    <ActionForm
      action={formAction}
      pending={pending}
      resultKey={state.status === "idle" ? undefined : state.operationId}
      className="flex min-h-0 flex-1 flex-col"
    >
      <DialogBody className="space-y-4">
        {item ? <input type="hidden" name={idFieldName} value={item.id} /> : null}

        {state.status === "error" ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Field id="catalogo-nombre" label="Nombre" required errors={fieldErrors?.nombre}>
          {(control) => <Input {...control} name="nombre" defaultValue={values.nombre} />}
        </Field>

        <Field id="catalogo-slug" label="Slug" required errors={fieldErrors?.slug}>
          {(control) => <Input {...control} name="slug" placeholder="materia_prima" defaultValue={values.slug} />}
        </Field>

        <Field id="catalogo-descripcion" label="Descripción" errors={fieldErrors?.descripcion}>
          {(control) => <Textarea {...control} name="descripcion" rows={4} defaultValue={values.descripcion} />}
        </Field>
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => surface?.requestClose()}>
          Cancelar
        </Button>
        <SubmitButton pendingText="Guardando...">{submitLabel}</SubmitButton>
      </DialogFooter>
    </ActionForm>
  );
}

// Alta o edicion de un tipo de proveedor o una categoria de material en ventana
// modal (entrega 10), con el mismo contrato que las categorias de producto de
// la entrega 9: FormDialog pide confirmar el descarte si hay cambios, no se
// cierra mientras guarda y, al guardar, da un solo aviso y se cierra; la lista
// se actualiza por el revalidatePath de la accion. En la edicion, el codigo
// describe la ventana.
export function InventoryCatalogDialog({ title, trigger, discardTitle, ...formProps }: InventoryCatalogDialogProps) {
  return (
    <FormDialog
      trigger={trigger}
      title={title}
      description={formProps.item?.id}
      discardTitle={discardTitle}
      discardDescription="Se perderán los datos que escribiste en esta ventana."
    >
      <CatalogForm {...formProps} />
    </FormDialog>
  );
}
