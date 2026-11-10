"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useMemo, type MouseEvent } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { DiscardConfirmDialog, useDiscardGuard, useFormResult } from "@/components/forms/form-surface";
import { OperationKeyField } from "@/components/forms/operation-key-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { hasListFilters } from "@/lib/navigation";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { InventoryOutputFormState } from "@/modules/inventory/movements/actions";

type Option = {
  id: string;
  label: string;
};

type InventoryOutputFormProps = {
  action: (
    prevState: InventoryOutputFormState,
    formData: FormData,
  ) => Promise<InventoryOutputFormState>;
  materials: Option[];
  workOrders: Option[];
  /**
   * Aviso que se da al guardar, del catalogo de Inventario. La pagina lo pasa con su clave
   * literal (inventoryNotifications["inventory-movement-created"]) para que
   * notification-registry.test.ts vea quien emite la clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: InventoryOutputFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const DISCARD = {
  title: "¿Descartar la salida?",
  description: "Se perderán los datos que escribiste en este formulario.",
};

// Formulario de la salida de inventario (C2 de la 11.2c), en su pagina como crear compra. La
// accion devuelve un resultado: con error, el mensaje general queda en el formulario, sin un
// segundo aviso, cada error va junto a su campo y ActionForm enfoca el primero; los select
// toman lo enviado como defaultValue al remontarse (React 19 reinicia el formulario tras la
// accion). Con exito hay un solo aviso, la clave de la operacion se renueva y se vuelve al
// listado con sus filtros. Con cambios, Cancelar pide confirmar.
export function InventoryOutputForm({
  action,
  materials,
  workOrders,
  successNotification,
  returnTo,
}: InventoryOutputFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;
  const completedKey = state.status === "success" ? state.data.clave_operacion : undefined;

  const notification = useMemo(
    () => (hasListFilters(returnTo) ? { ...successNotification, description: FILTER_HINT } : successNotification),
    [successNotification, returnTo],
  );
  const goBack = useCallback(() => router.push(returnTo), [router, returnTo]);
  const { controls, markDirty, trackFocus, discardDialog } = useDiscardGuard({ onLeave: goBack });

  // Mientras la accion esta pendiente, Cancelar no sale.
  useEffect(() => {
    controls.setBusy(pending);
  }, [controls, pending]);

  // Un aviso por operacion; tras guardar vuelve al listado sin preguntar.
  useFormResult(state, pending, { successNotification: notification, onSuccess: controls.closeAfterSave });

  // Un clic normal en Cancelar pasa por el descarte; con una tecla de modificador o la
  // rueda, el enlace abre el listado en otra pestana.
  function handleCancel(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    controls.requestClose();
  }

  return (
    <>
      <ActionForm
        action={formAction}
        pending={pending}
        resultKey={resultKey}
        className="space-y-4 rounded-xl border border-border/80 bg-card p-6"
        onInput={() => markDirty(true)}
        onFocus={trackFocus}
      >
        <OperationKeyField scope="salida:nueva" completedKey={completedKey} />

        {state.status === "error" ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Field id="id_material" label="Material" required errors={fieldErrors?.id_material}>
            {(control) => (
              <NativeSelect {...control} name="id_material" defaultValue={values?.id_material ?? ""}>
                <option value="">Seleccione material</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>

          <Field id="id_orden_trabajo" label="Orden de trabajo" errors={fieldErrors?.id_orden_trabajo}>
            {(control) => (
              <NativeSelect {...control} name="id_orden_trabajo" defaultValue={values?.id_orden_trabajo ?? ""}>
                <option value="">Sin orden asociada</option>
                {workOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
        </div>

        <Field id="cantidad" label="Cantidad" required errors={fieldErrors?.cantidad}>
          {(control) => (
            <Input
              {...control}
              name="cantidad"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={values?.cantidad ?? ""}
            />
          )}
        </Field>

        <Field id="motivo" label="Motivo" required errors={fieldErrors?.motivo}>
          {(control) => <Textarea {...control} name="motivo" rows={4} defaultValue={values?.motivo ?? ""} />}
        </Field>

        <div className="flex gap-2">
          <SubmitButton pendingText="Guardando...">Registrar salida</SubmitButton>
          <Button variant="outline" asChild>
            <Link href={returnTo} onClick={handleCancel}>
              Cancelar
            </Link>
          </Button>
        </div>
      </ActionForm>

      <DiscardConfirmDialog {...discardDialog} {...DISCARD} />
    </>
  );
}
