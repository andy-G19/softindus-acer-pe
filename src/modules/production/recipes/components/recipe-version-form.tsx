"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field, FieldError } from "@/components/forms/field";
import { DiscardConfirmDialog, useDiscardGuard, useFormResult } from "@/components/forms/form-surface";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RecipeVersionFormState, RecipeVersionLineValues } from "@/modules/production/recipe-versions/actions";

type MaterialOption = {
  id_material: string;
  nombre_material: string;
  categoria: string;
  unidad_medida: string;
  costo_unitario_actual: string;
};

type VersionDetailDraft = RecipeVersionLineValues & { key: string };

type RecipeVersionFormProps = {
  action: (prevState: RecipeVersionFormState, formData: FormData) => Promise<RecipeVersionFormState>;
  idReceta: string;
  /** Lista de versiones, a la que vuelve al guardar o cancelar. */
  returnTo: string;
  materials: MaterialOption[];
  initialDetails?: VersionDetailDraft[];
  canCreateVersion: boolean;
  /** Aviso al guardar; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

const initialState: RecipeVersionFormState = { status: "idle" };

const DEFAULT_REASON = "Nueva versión de receta técnica.";

const DISCARD = {
  title: "¿Descartar la versión nueva?",
  description: "Se perderán los cambios que hiciste en este formulario.",
};

function createEmptyDetail(key: string): VersionDetailDraft {
  return {
    key,
    id_material: "",
    cantidad_requerida: "1",
    tipo_consumo: "materia_prima",
    merma_estimada_porcentaje: "0",
    observaciones: "",
  };
}

// Alta de una version de receta (entrega 10.6b), la superficie amplia de Produccion,
// con el patron de Pedidos: una pagina completa, no un panel. Las lineas parten de
// la version base y son estado del formulario: sobreviven al resultado de la accion,
// que remonta los campos (ActionForm). El tipo de consumo usa defaultValue con su
// onChange, porque React 19 reinicia el formulario tras la accion y un select
// controlado volveria a la primera opcion (hallazgo 13 de la 10.6a). Los ids de una
// linea llevan su key: la posicion cambia al quitar una.
//
// Quitar una linea es un cambio, a diferencia de Reparaciones: aqui se quita lo que
// venia de la version base. Lleva el foco a Agregar material, porque el boton que lo
// tenia desaparece.
//
// El material no lleva required: el buscador se ve vacio con un material que ya no
// esta activo, y el navegador frenaria el envio sin decir por que. Asi la accion
// responde en su linea (R4 de la 10.6). El asterisco va en la etiqueta.
export function RecipeVersionForm({
  action,
  idReceta,
  returnTo,
  materials,
  initialDetails = [],
  canCreateVersion,
  successNotification,
}: RecipeVersionFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [nextKey, setNextKey] = useState(Math.max(initialDetails.length + 1, 2));
  const [details, setDetails] = useState<VersionDetailDraft[]>(
    initialDetails.length > 0 ? initialDetails : [createEmptyDetail("row-1")],
  );
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const reason = state.status === "idle" ? DEFAULT_REASON : state.values.motivo_cambio;

  const goBack = useCallback(() => router.push(returnTo), [router, returnTo]);
  const { controls, markDirty, trackFocus, discardDialog } = useDiscardGuard({ onLeave: goBack });

  // Mientras la accion esta pendiente, Cancelar no sale.
  useEffect(() => {
    controls.setBusy(pending);
  }, [controls, pending]);

  // Un aviso por operacion; tras guardar vuelve a la lista sin preguntar.
  useFormResult(state, pending, { successNotification, onSuccess: controls.closeAfterSave });

  const resultKey = state.status === "idle" ? undefined : state.operationId;

  const materialItems = useMemo(() => {
    return materials.map((material) => ({
      id: material.id_material,
      label: material.nombre_material,
      description: `${material.categoria} - ${material.unidad_medida} - S/ ${Number(
        material.costo_unitario_actual,
      ).toFixed(2)}`,
    }));
  }, [materials]);

  // Un clic normal en Cancelar pasa por el descarte; con una tecla de
  // modificador o la rueda, el enlace abre la lista en otra pestana.
  function handleCancel(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    controls.requestClose();
  }

  function addDetail() {
    markDirty(true);
    setDetails((currentDetails) => [...currentDetails, createEmptyDetail(`row-${nextKey}`)]);
    setNextKey((currentKey) => currentKey + 1);
  }

  function removeDetail(key: string) {
    markDirty(true);
    setDetails((currentDetails) => currentDetails.filter((detail) => detail.key !== key));
    addButtonRef.current?.focus();
  }

  function updateDetail(key: string, field: keyof RecipeVersionLineValues, value: string) {
    setDetails((currentDetails) =>
      currentDetails.map((detail) => (detail.key === key ? { ...detail, [field]: value } : detail)),
    );
  }

  return (
    <>
      <ActionForm
        action={formAction}
        pending={pending}
        resultKey={resultKey}
        className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
        onInput={() => markDirty(true)}
        onFocus={trackFocus}
      >
        <input type="hidden" name="id_receta" value={idReceta} />

        {state.status === "error" ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Field
          id="motivo_cambio"
          label="Motivo o descripción"
          disabled={!canCreateVersion}
          errors={fieldErrors?.motivo_cambio}
        >
          {(control) => (
            <Textarea
              {...control}
              name="motivo_cambio"
              rows={4}
              maxLength={700}
              defaultValue={reason}
              placeholder="Ej. Ajuste de materiales por cambio de proveedor o mejora de proceso."
            />
          )}
        </Field>

        <section className="space-y-4 rounded-lg border border-border/80 p-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="font-semibold">Materiales de la versión</h2>
              <p className="text-sm text-muted-foreground">
                La nueva versión quedará vigente y reemplazará la versión vigente anterior.
              </p>
            </div>

            <Button
              ref={addButtonRef}
              type="button"
              variant="outline"
              size="sm"
              onClick={addDetail}
              disabled={!canCreateVersion}
            >
              Agregar material
            </Button>
          </div>

          <div className="space-y-4">
            {details.map((detail, index) => {
              const line = `detalles.${index}`;
              const materialId = `id_material-${detail.key}`;
              const materialErrors = fieldErrors?.[`${line}.id_material`];

              return (
                <div key={detail.key} className="rounded-lg border border-border/80 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Material {index + 1}</h3>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDetail(detail.key)}
                      disabled={details.length === 1}
                      className="text-destructive hover:text-destructive"
                    >
                      Quitar
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1.4fr_0.7fr_0.8fr_0.7fr]">
                    <div className="space-y-2">
                      <SearchableSelect
                        id={materialId}
                        name="id_material"
                        label="Material *"
                        placeholder="Buscar material..."
                        items={materialItems}
                        value={detail.id_material}
                        disabled={!canCreateVersion}
                        emptyMessage="No hay materiales activos."
                        onValueChange={(value) => updateDetail(detail.key, "id_material", value)}
                        {...(materialErrors?.length
                          ? { "aria-invalid": true as const, "aria-describedby": `${materialId}-error` }
                          : {})}
                      />
                      <FieldError id={`${materialId}-error`} messages={materialErrors} />
                    </div>

                    <Field
                      id={`cantidad_requerida-${detail.key}`}
                      label="Cantidad"
                      required
                      disabled={!canCreateVersion}
                      errors={fieldErrors?.[`${line}.cantidad_requerida`]}
                    >
                      {(control) => (
                        <Input
                          {...control}
                          name="cantidad_requerida"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={detail.cantidad_requerida}
                          onChange={(event) => updateDetail(detail.key, "cantidad_requerida", event.target.value)}
                        />
                      )}
                    </Field>

                    <Field
                      id={`tipo_consumo-${detail.key}`}
                      label="Tipo"
                      required
                      disabled={!canCreateVersion}
                      errors={fieldErrors?.[`${line}.tipo_consumo`]}
                    >
                      {(control) => (
                        <NativeSelect
                          {...control}
                          name="tipo_consumo"
                          defaultValue={detail.tipo_consumo}
                          onChange={(event) => updateDetail(detail.key, "tipo_consumo", event.target.value)}
                        >
                          <option value="materia_prima">Materia prima</option>
                          <option value="consumible">Consumible</option>
                          <option value="auxiliar">Auxiliar</option>
                        </NativeSelect>
                      )}
                    </Field>

                    <Field
                      id={`merma_estimada_porcentaje-${detail.key}`}
                      label="Merma %"
                      disabled={!canCreateVersion}
                      errors={fieldErrors?.[`${line}.merma_estimada_porcentaje`]}
                    >
                      {(control) => (
                        <Input
                          {...control}
                          name="merma_estimada_porcentaje"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={detail.merma_estimada_porcentaje}
                          onChange={(event) =>
                            updateDetail(detail.key, "merma_estimada_porcentaje", event.target.value)
                          }
                        />
                      )}
                    </Field>
                  </div>

                  <Field
                    id={`observaciones_detalle-${detail.key}`}
                    label="Observaciones"
                    disabled={!canCreateVersion}
                    errors={fieldErrors?.[`${line}.observaciones`]}
                    className="mt-4"
                  >
                    {(control) => (
                      <Input
                        {...control}
                        name="observaciones_detalle"
                        value={detail.observaciones}
                        onChange={(event) => updateDetail(detail.key, "observaciones", event.target.value)}
                        placeholder="Observación opcional del material."
                      />
                    )}
                  </Field>
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex items-center justify-between pt-4">
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href={returnTo} onClick={handleCancel}>
              Cancelar
            </Link>
          </Button>

          <SubmitButton pendingText="Guardando..." disabled={!canCreateVersion}>
            Crear versión vigente
          </SubmitButton>
        </div>
      </ActionForm>

      <DiscardConfirmDialog {...discardDialog} {...DISCARD} />
    </>
  );
}
