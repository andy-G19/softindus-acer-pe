"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, type ReactElement } from "react";

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
import type { ExpenseCategoryFormState } from "@/modules/petty-cash/categories/actions";

type CategoryAction = (prevState: ExpenseCategoryFormState, formData: FormData) => Promise<ExpenseCategoryFormState>;

type ExpenseCategoryFormProps = {
  action: CategoryAction;
  /** Categoria que se edita; sin ella es un alta. */
  category?: {
    id_categoria_gasto: string;
    nombre_categoria: string;
    descripcion: string | null;
  };
  submitLabel: string;
  /** Aviso del catalogo de Caja chica; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

const LIST_PATH = "/dashboard/petty-cash/categories";

const initialState: ExpenseCategoryFormState = { status: "idle" };

// Formulario de categoria de gasto (entrega 10). En la ventana modal de la
// lista, los campos van en el cuerpo y los botones en el pie; Cancelar pide
// cerrar (con confirmacion si hay cambios) y guardar la cierra. En la pagina
// de edicion (la URL directa), guardar vuelve a la lista y el enlace del pie
// tambien. Con error se conserva lo escrito y el mensaje queda en el
// formulario, sin toast; con exito, un solo aviso. No tiene campo Estado: el
// estado cambia desde la fila de la lista.
export function ExpenseCategoryForm({ action, category, submitLabel, successNotification }: ExpenseCategoryFormProps) {
  const router = useRouter();
  const surface = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);

  const values =
    state.status === "idle"
      ? { nombre_categoria: category?.nombre_categoria ?? "", descripcion: category?.descripcion ?? "" }
      : state.values;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;

  const backToList = useCallback(() => router.push(LIST_PATH), [router]);

  useFormResult(state, pending, { successNotification, onSuccess: backToList });

  const fields = (
    <>
      {category ? <input type="hidden" name="id_categoria_gasto" value={category.id_categoria_gasto} /> : null}

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Field id="nombre_categoria" label="Nombre de categoría" required errors={fieldErrors?.nombre_categoria}>
        {(control) => <Input {...control} name="nombre_categoria" defaultValue={values.nombre_categoria} />}
      </Field>

      <Field id="descripcion" label="Descripción" errors={fieldErrors?.descripcion}>
        {(control) => <Textarea {...control} name="descripcion" rows={4} defaultValue={values.descripcion} />}
      </Field>
    </>
  );

  if (surface) {
    return (
      <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="flex min-h-0 flex-1 flex-col">
        <DialogBody className="space-y-4">{fields}</DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => surface.requestClose()}>
            Cancelar
          </Button>
          <SubmitButton pendingText="Guardando...">{submitLabel}</SubmitButton>
        </DialogFooter>
      </ActionForm>
    );
  }

  return (
    <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="space-y-4">
      {fields}

      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton pendingText="Guardando...">{submitLabel}</SubmitButton>
        <Button variant="outline" asChild>
          <Link href={LIST_PATH}>Volver al listado</Link>
        </Button>
      </div>
    </ActionForm>
  );
}

type ExpenseCategoryDialogProps = ExpenseCategoryFormProps & {
  title: string;
  /** Boton que abre la ventana (Radix le devuelve el foco al cerrarla). */
  trigger: ReactElement;
};

// Alta o edicion de una categoria de gasto en ventana modal, desde la lista
// (entrega 10). En la edicion, el codigo describe la ventana.
export function ExpenseCategoryDialog({ title, trigger, ...formProps }: ExpenseCategoryDialogProps) {
  return (
    <FormDialog
      trigger={trigger}
      title={title}
      description={formProps.category?.id_categoria_gasto}
      discardTitle="¿Descartar la categoría de gasto?"
      discardDescription="Se perderán los datos que escribiste en esta ventana."
    >
      <ExpenseCategoryForm {...formProps} />
    </FormDialog>
  );
}
