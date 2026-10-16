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
import type { ProductCategoryFormState } from "@/modules/commercial/products/actions";

type CategoryAction = (prevState: ProductCategoryFormState, formData: FormData) => Promise<ProductCategoryFormState>;

type CategoryValues = {
  id_categoria_producto: string;
  nombre: string;
  descripcion: string | null;
};

type ProductCategoryDialogProps = {
  action: CategoryAction;
  /** Categoria que se edita; sin ella es un alta. */
  category?: CategoryValues;
  title: string;
  submitLabel: string;
  /** Aviso del catalogo de Comercial; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
  /** Boton que abre la ventana (Radix le devuelve el foco al cerrarla). */
  trigger: ReactElement;
};

const initialState: ProductCategoryFormState = { status: "idle" };

// Formulario de la ventana. Se monta cada vez que se abre: empieza sin estado.
function CategoryForm({
  action,
  category,
  submitLabel,
  successNotification,
}: Omit<ProductCategoryDialogProps, "title" | "trigger">) {
  const surface = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);

  const values =
    state.status === "idle"
      ? { nombre: category?.nombre ?? "", descripcion: category?.descripcion ?? "" }
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
        {category ? (
          <input type="hidden" name="id_categoria_producto" value={category.id_categoria_producto} />
        ) : null}

        {state.status === "error" ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Field
          id="categoria-nombre"
          label="Nombre"
          description="El slug se genera a partir del nombre."
          required
          errors={fieldErrors?.nombre}
        >
          {(control) => (
            <Input {...control} name="nombre" placeholder="Ejemplo: Herramientas agrícolas" defaultValue={values.nombre} />
          )}
        </Field>

        <Field id="categoria-descripcion" label="Descripción" errors={fieldErrors?.descripcion}>
          {(control) => (
            <Textarea
              {...control}
              name="descripcion"
              className="min-h-24"
              placeholder="Uso interno de la categoría."
              defaultValue={values.descripcion}
            />
          )}
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

// Alta o edicion de una categoria de producto en ventana modal (entrega 9): la
// variante sin URL del piloto, para catalogos breves. FormDialog la abre con
// su boton, pide confirmar el descarte si hay cambios, no se cierra mientras
// guarda y, al guardar, da un solo aviso y se cierra; la lista se actualiza
// por el revalidatePath de la accion. En la edicion, el codigo describe la
// ventana.
export function ProductCategoryDialog({ title, trigger, ...formProps }: ProductCategoryDialogProps) {
  return (
    <FormDialog
      trigger={trigger}
      title={title}
      description={formProps.category?.id_categoria_producto}
      discardTitle="¿Descartar la categoría?"
      discardDescription="Se perderán los datos que escribiste en esta ventana."
    >
      <CategoryForm {...formProps} />
    </FormDialog>
  );
}
