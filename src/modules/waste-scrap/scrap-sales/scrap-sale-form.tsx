"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, type MouseEvent, type ReactNode } from "react";

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
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { ScrapSaleFormState } from "@/modules/waste-scrap/scrap-sales/actions";

export type ScrapSaleOption = { value: string; label: string };

type ScrapSaleFormProps = {
  action: (prevState: ScrapSaleFormState, formData: FormData) => Promise<ScrapSaleFormState>;
  /** Chatarra que se puede vender, con el texto que arma la pagina. */
  scraps: ScrapSaleOption[];
  /** Cajas abiertas, con el texto que arma la pagina. */
  cashBoxes: ScrapSaleOption[];
  /** La chatarra que llega elegida desde el listado, con su peso y su cantidad propuestos. */
  defaultScrapId: string;
  defaultWeight: string;
  defaultQuantity: string;
  /** Fecha que propone el campo (aaaa-mm-dd), calculada por la pagina. */
  defaultDate: string;
  /** Resumen de la chatarra elegida desde el listado, armado por la pagina. */
  selectedScrapSummary?: ReactNode;
  /**
   * Aviso que se da al guardar, del catalogo de Mermas y chatarra. La pagina lo pasa con su clave
   * literal (wasteScrapNotifications["scrap-sale-created"]) para que
   * notification-registry.test.ts vea quien emite la clave.
   */
  successNotification: NotificationDefinition;
  /** Pagina a la que vuelve al guardar o cancelar; la pagina ya la valido. */
  returnTo: string;
};

const initialState: ScrapSaleFormState = { status: "idle" };

const DISCARD = {
  title: "¿Descartar la venta?",
  description: "Se perderán los datos que escribiste en este formulario.",
};

// Formulario de la venta de chatarra (C4 de la 11.4b, D48), como el del egreso de caja chica (C5
// de la 11.4a): con error, el mensaje general queda en el formulario y cada error va junto a su
// campo, con lo enviado; con exito hay un solo aviso, la clave se renueva y se vuelve al listado.
export function ScrapSaleForm({
  action,
  scraps,
  cashBoxes,
  defaultScrapId,
  defaultWeight,
  defaultQuantity,
  defaultDate,
  selectedScrapSummary,
  successNotification,
  returnTo,
}: ScrapSaleFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;
  const completedKey = state.status === "success" ? state.data.clave_operacion : undefined;

  const goBack = useCallback(() => router.push(returnTo), [router, returnTo]);
  const { controls, markDirty, trackFocus, discardDialog } = useDiscardGuard({ onLeave: goBack });

  // Mientras la accion esta pendiente, Cancelar no sale.
  useEffect(() => {
    controls.setBusy(pending);
  }, [controls, pending]);

  // Un aviso por operacion; tras guardar vuelve sin preguntar.
  useFormResult(state, pending, { successNotification, onSuccess: controls.closeAfterSave });

  // Un clic normal en Cancelar pasa por el descarte; con una tecla de modificador o la rueda, el
  // enlace abre la pagina en otra pestana.
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
        className="space-y-5"
        onInput={() => markDirty(true)}
        onFocus={trackFocus}
      >
        <OperationKeyField scope="venta_chatarra:nueva" completedKey={completedKey} />

        {state.status === "error" ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field
              id="id_chatarra"
              label="Chatarra a vender"
              required
              description="Solo se muestran registros con estado acumulada o disponible."
              errors={fieldErrors?.id_chatarra}
            >
              {(control) => (
                <NativeSelect {...control} name="id_chatarra" defaultValue={values?.id_chatarra ?? defaultScrapId}>
                  <option value="" disabled>
                    Selecciona un registro de chatarra
                  </option>
                  {scraps.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          </div>

          {selectedScrapSummary ? <div className="md:col-span-2">{selectedScrapSummary}</div> : null}

          <Field id="fecha_venta" label="Fecha de venta" required errors={fieldErrors?.fecha_venta}>
            {(control) => (
              <Input {...control} name="fecha_venta" type="date" defaultValue={values?.fecha_venta ?? defaultDate} />
            )}
          </Field>

          <Field id="monto_recibido" label="Monto recibido" required errors={fieldErrors?.monto_recibido}>
            {(control) => (
              <Input
                {...control}
                name="monto_recibido"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={values?.monto_recibido ?? ""}
                placeholder="Ejemplo: 80.00"
              />
            )}
          </Field>

          <Field
            id="peso_vendido_kg"
            label="Peso vendido en kg"
            description="Si lo dejas vacío, se usará el peso registrado en la chatarra."
            errors={fieldErrors?.peso_vendido_kg}
          >
            {(control) => (
              <Input
                {...control}
                name="peso_vendido_kg"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={values?.peso_vendido_kg ?? defaultWeight}
                placeholder="Ejemplo: 15.00"
              />
            )}
          </Field>

          <Field
            id="cantidad_vendida"
            label="Cantidad vendida"
            description="Útil si la venta se controla por bolsa, piezas o lote."
            errors={fieldErrors?.cantidad_vendida}
          >
            {(control) => (
              <Input
                {...control}
                name="cantidad_vendida"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={values?.cantidad_vendida ?? defaultQuantity}
                placeholder="Ejemplo: 3"
              />
            )}
          </Field>

          <Field
            id="id_caja_chica"
            label="Registrar ingreso en caja chica"
            description="Opcional. Si seleccionas una caja, se generará un movimiento de ingreso."
            errors={fieldErrors?.id_caja_chica}
          >
            {(control) => (
              <NativeSelect {...control} name="id_caja_chica" defaultValue={values?.id_caja_chica ?? ""}>
                <option value="">No registrar en caja chica</option>
                {cashBoxes.map((box) => (
                  <option key={box.value} value={box.value}>
                    {box.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>

          <Field id="destino_dinero" label="Destino del dinero" errors={fieldErrors?.destino_dinero}>
            {(control) => (
              <Input
                {...control}
                name="destino_dinero"
                type="text"
                defaultValue={values?.destino_dinero ?? ""}
                placeholder="Ejemplo: compra de discos de corte"
              />
            )}
          </Field>

          <div className="md:col-span-2">
            <Field id="observaciones" label="Observaciones" errors={fieldErrors?.observaciones}>
              {(control) => (
                <Textarea
                  {...control}
                  name="observaciones"
                  rows={4}
                  defaultValue={values?.observaciones ?? ""}
                  placeholder="Ejemplo: venta realizada a reciclador local"
                />
              )}
            </Field>
          </div>
        </div>

        <div className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Efecto de la operación</p>
          <p className="mt-1">
            Al registrar la venta, la chatarra cambiará a estado <span className="font-semibold">vendida</span>. Si
            seleccionas una caja chica, también se incrementará su saldo con el monto recibido.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
          <Button variant="outline" asChild>
            <Link href={returnTo} onClick={handleCancel}>
              Cancelar
            </Link>
          </Button>
          <SubmitButton pendingText="Registrando..." disabled={scraps.length === 0}>
            Registrar venta
          </SubmitButton>
        </div>
      </ActionForm>

      <DiscardConfirmDialog {...discardDialog} {...DISCARD} />
    </>
  );
}
