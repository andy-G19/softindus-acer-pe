"use client";

import { useActionState, useCallback, useEffect, useRef, useState, type ReactElement } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { ConfirmDialog } from "@/components/notifications/confirm-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import { notify } from "@/lib/notifications";
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

type FormControls = {
  onSaved: () => void;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
};

const initialState: ProductCategoryFormState = { status: "idle" };

// Formulario de la ventana. Se monta cada vez que se abre: empieza sin estado.
function CategoryForm({
  action,
  category,
  submitLabel,
  successNotification,
  onSaved,
  onCancel,
  onBusyChange,
}: Omit<ProductCategoryDialogProps, "title" | "trigger"> & FormControls) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const values =
    state.status === "idle"
      ? { nombre: category?.nombre ?? "", descripcion: category?.descripcion ?? "" }
      : state.values;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  useEffect(() => {
    onBusyChange(pending);
  }, [onBusyChange, pending]);

  // Un aviso por operacion: los controles de la ventana son estables.
  useEffect(() => {
    if (state.status === "success") {
      notify(successNotification);
      onSaved();
    }
  }, [state, successNotification, onSaved]);

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
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <SubmitButton pendingText="Guardando...">{submitLabel}</SubmitButton>
      </DialogFooter>
    </ActionForm>
  );
}

// Alta o edicion de una categoria de producto en ventana modal (entrega 9): la
// variante sin URL del piloto, para catalogos breves. La abre su boton y, al
// cerrarla, Radix devuelve el foco a ese boton. Escribir deja cambios
// pendientes: cerrar (Cancelar, X, Esc o el velo) pide confirmar el descarte;
// mientras guarda no se cierra; al guardar, un solo aviso y se cierra, y la
// lista se actualiza por el revalidatePath de la accion.
export function ProductCategoryDialog({ title, trigger, ...formProps }: ProductCategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dirtyRef = useRef(false);
  const busyRef = useRef(false);

  const close = useCallback(() => {
    dirtyRef.current = false;
    setOpen(false);
  }, []);

  const requestClose = useCallback(() => {
    if (busyRef.current) {
      return;
    }
    if (dirtyRef.current) {
      setConfirmOpen(true);
      return;
    }
    close();
  }, [close]);

  const setBusy = useCallback((busy: boolean) => {
    busyRef.current = busy;
  }, []);

  function changeOpen(next: boolean) {
    if (next) {
      dirtyRef.current = false;
      setOpen(true);
    } else {
      requestClose();
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent
          // En el alta no hay descripcion: aria-describedby={undefined} le dice a
          // Radix que es a proposito. En la edicion Radix asocia la suya.
          {...(formProps.category ? {} : { "aria-describedby": undefined })}
          onInput={() => {
            dirtyRef.current = true;
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {formProps.category ? (
              <DialogDescription>{formProps.category.id_categoria_producto}</DialogDescription>
            ) : null}
          </DialogHeader>
          <CategoryForm {...formProps} onSaved={close} onCancel={requestClose} onBusyChange={setBusy} />
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        variant="destructive"
        title="¿Descartar la categoría?"
        description="Se perderán los datos que escribiste en esta ventana."
        confirmText="Descartar cambios"
        onConfirm={close}
      />
    </>
  );
}
