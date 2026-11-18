"use client";

import { useActionState, type ReactNode } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { useFormResult } from "@/components/forms/form-surface";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type {
  CloseMaterialsFormState,
  ReopenMaterialsFormState,
} from "@/modules/production/work-orders/actions";
import {
  CloseMaterialsForm,
  type CloseMaterialLine,
} from "@/modules/production/work-orders/close-materials-form";

type MaterialClosureSectionProps = {
  idOrdenTrabajo: string;
  /** Los materiales de la orden ya están cerrados. */
  closed: boolean;
  /** Solo ADMIN reabre, y nunca una orden anulada: lo decide la página. */
  canReopen: boolean;
  /** La conciliación empieza con la primera entrega. */
  hasDeliveries: boolean;
  /** El resumen del cierre (fecha y unidades producidas), que arma la página. */
  closedSummary: ReactNode;
  /** La entrega adicional o devolución, que solo se ofrece con los materiales abiertos. */
  movementForm: ReactNode;
  lines: CloseMaterialLine[];
  productUnit: string;
  closeAction: (prevState: CloseMaterialsFormState, formData: FormData) => Promise<CloseMaterialsFormState>;
  reopenAction: (prevState: ReopenMaterialsFormState, formData: FormData) => Promise<ReopenMaterialsFormState>;
  /**
   * Avisos que se dan al guardar, del catálogo de Producción. La página los pasa con su clave
   * literal para que notification-registry.test.ts vea quién emite cada clave.
   */
  closeNotification: NotificationDefinition;
  reopenNotification: NotificationDefinition;
};

const initialCloseState: CloseMaterialsFormState = { status: "idle" };
const initialReopenState: ReopenMaterialsFormState = { status: "idle" };

// C2 de la 11.6b (D74): cerrar cambia lo que muestra el detalle (el formulario de cierre se vuelve
// el resumen con «Reabrir») y reabrir lo devuelve, y la revalidación trae ese cambio con la misma
// respuesta. Un formulario que se desmonta en ese repintado nunca da su aviso (hallazgo 9 de la
// 11.2a): por eso los dos resultados viven aquí, en la sección que queda montada en los dos estados,
// y los formularios solo los pintan.
export function MaterialClosureSection({
  idOrdenTrabajo,
  closed,
  canReopen,
  hasDeliveries,
  closedSummary,
  movementForm,
  lines,
  productUnit,
  closeAction,
  reopenAction,
  closeNotification,
  reopenNotification,
}: MaterialClosureSectionProps) {
  const [closeState, closeFormAction, closePending] = useActionState(closeAction, initialCloseState);
  const [reopenState, reopenFormAction, reopenPending] = useActionState(reopenAction, initialReopenState);

  // Un aviso por operación; el detalle se repinta con la revalidación de la acción.
  useFormResult(closeState, closePending, { successNotification: closeNotification });
  useFormResult(reopenState, reopenPending, { successNotification: reopenNotification });

  if (closed) {
    return (
      <>
        {closedSummary}

        {canReopen ? (
          <ReopenForm
            idOrdenTrabajo={idOrdenTrabajo}
            state={reopenState}
            formAction={reopenFormAction}
            pending={reopenPending}
          />
        ) : null}
      </>
    );
  }

  if (!hasDeliveries) {
    return (
      <Alert variant="info">
        <AlertDescription>
          Todavía no se entregó material a esta orden. La conciliación
          se habilita con la primera entrega.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-3 font-semibold">Entrega adicional o devolución</h3>
        {movementForm}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-semibold">Cerrar materiales</h3>
        <CloseMaterialsForm
          idOrdenTrabajo={idOrdenTrabajo}
          lines={lines}
          productUnit={productUnit}
          state={closeState}
          formAction={closeFormAction}
          pending={closePending}
        />
      </div>
    </>
  );
}

type ReopenFormProps = {
  idOrdenTrabajo: string;
  state: ReopenMaterialsFormState;
  formAction: (formData: FormData) => void;
  pending: boolean;
};

function ReopenForm({ idOrdenTrabajo, state, formAction, pending }: ReopenFormProps) {
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  // Con éxito la sección deja de mostrar este formulario: solo un error devuelve lo enviado.
  const values = state.status === "error" ? state.values : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;

  return (
    <ActionForm
      action={formAction}
      pending={pending}
      resultKey={resultKey}
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <input type="hidden" name="id_orden_trabajo" value={idOrdenTrabajo} />

      <div>
        <h3 className="font-semibold">Reabrir el cierre</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Permite volver a declarar el consumo y las unidades producidas. No revierte ningún
          movimiento de almacén: las entregas y devoluciones quedan intactas. Queda registrado en
          la bitácora.
        </p>
      </div>

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Field id="motivo_reapertura" label="Motivo" required errors={fieldErrors?.motivo}>
        {(control) => (
          <Textarea
            {...control}
            name="motivo"
            rows={2}
            maxLength={300}
            defaultValue={values?.motivo}
            placeholder="Ej. el conteo de barras estaba mal, sobraron 2.5 en el almacén de planta."
          />
        )}
      </Field>

      <SubmitButton variant="outline" pendingText="Reabriendo cierre...">
        Reabrir cierre de materiales
      </SubmitButton>
    </ActionForm>
  );
}
