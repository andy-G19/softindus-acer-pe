"use client";

import { useActionState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { useFormResult, useFormSurface } from "@/components/forms/form-surface";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { CampaignDetailFormState } from "@/modules/production/campaigns/actions";

type ProductOption = {
  id_producto: string;
  nombre_producto: string;
  categoria: string;
  unidad_medida: string;
};

type CampaignDetailFormProps = {
  action: (prevState: CampaignDetailFormState, formData: FormData) => Promise<CampaignDetailFormState>;
  idCampania: string;
  /** Productos activos que la campana todavia no tiene. */
  products: ProductOption[];
  /** Aviso del catalogo de Produccion; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

const initialState: CampaignDetailFormState = { status: "idle" };

const emptyValues = { id_producto: "", cantidad_objetivo: "", observaciones: "" };

// Formulario de la ventana: los campos en el cuerpo y los botones en el pie. Con
// error se conserva lo escrito y el mensaje queda dentro, sin toast; con exito, un
// solo aviso y la ventana se cierra. El detalle se actualiza por el revalidatePath de
// la accion, tambien la lista de productos que quedan por agregar.
function CampaignDetailForm({ action, idCampania, products, successNotification }: CampaignDetailFormProps) {
  const surface = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);

  const values = state.status === "idle" ? emptyValues : state.values;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;
  const hasProducts = products.length > 0;

  useFormResult(state, pending, { successNotification });

  return (
    <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="space-y-4">
        <input type="hidden" name="id_campania" value={idCampania} />

        {state.status === "error" ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {!hasProducts ? (
          <Alert variant="warning">
            <AlertDescription>
              No hay productos activos disponibles para agregar, o todos los productos activos ya están registrados en
              esta campaña.
            </AlertDescription>
          </Alert>
        ) : null}

        <Field id="id_producto" label="Producto" required disabled={!hasProducts} errors={fieldErrors?.id_producto}>
          {(control) => (
            <NativeSelect {...control} name="id_producto" defaultValue={values.id_producto}>
              <option value="">Seleccione un producto</option>

              {products.map((product) => (
                <option key={product.id_producto} value={product.id_producto}>
                  {product.nombre_producto} · {product.categoria} · {product.unidad_medida}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field
          id="cantidad_objetivo"
          label="Cantidad objetivo"
          required
          disabled={!hasProducts}
          errors={fieldErrors?.cantidad_objetivo}
        >
          {(control) => (
            <Input
              {...control}
              name="cantidad_objetivo"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Ej. 100"
              defaultValue={values.cantidad_objetivo}
            />
          )}
        </Field>

        <Field id="observaciones" label="Observaciones" disabled={!hasProducts} errors={fieldErrors?.observaciones}>
          {(control) => (
            <Textarea
              {...control}
              name="observaciones"
              rows={4}
              maxLength={500}
              placeholder="Ej. Priorizar este producto durante la primera semana."
              defaultValue={values.observaciones}
            />
          )}
        </Field>

        <Alert variant="info">
          <AlertDescription>Un producto solo puede registrarse una vez dentro de la misma campaña.</AlertDescription>
        </Alert>
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => surface?.requestClose()}>
          Cancelar
        </Button>
        <SubmitButton pendingText="Guardando..." disabled={!hasProducts}>
          Agregar producto
        </SubmitButton>
      </DialogFooter>
    </ActionForm>
  );
}

type CampaignDetailDialogProps = CampaignDetailFormProps & {
  nombreCampania: string;
};

// Agregar un producto a la campana en ventana modal, desde su detalle (entrega 10.7a).
// Sustituye a la pagina details/new (D3 de la 10.7): el formulario tiene tres campos
// y solo se llega a el desde este boton.
export function CampaignDetailDialog({ nombreCampania, ...formProps }: CampaignDetailDialogProps) {
  return (
    <FormDialog
      trigger={
        <Button type="button" variant="outline">
          Agregar producto
        </Button>
      }
      title="Agregar producto a campaña"
      description={`Campaña: ${nombreCampania}`}
      discardTitle="¿Descartar el producto?"
      discardDescription="Se perderán los datos que escribiste en esta ventana."
    >
      <CampaignDetailForm {...formProps} />
    </FormDialog>
  );
}
