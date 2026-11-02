"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useState, type ReactNode } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field, FieldError } from "@/components/forms/field";
import { useFormResult, useFormSurface } from "@/components/forms/form-surface";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import {
  applyWaste,
  calculateRequiredQuantity,
  roundQuantity,
} from "@/lib/recipe-quantities";
import type {
  RecipeDetailFormState,
  RecipeDetailFormValues,
} from "@/modules/production/recipe-details/actions";

export type RecipeDetailMaterialOption = {
  id: string;
  label: string;
  description?: string;
  unidad_medida: string;
};

type RecipeDetailFormProps = {
  action: (prevState: RecipeDetailFormState, formData: FormData) => Promise<RecipeDetailFormState>;
  versionId: string;
  materials: RecipeDetailMaterialOption[];
  /** Valores de la linea que se edita; en el alta, vacios. */
  defaultValues?: Partial<RecipeDetailFormValues> & { id_detalle_receta?: string };
  submitLabel: string;
  /**
   * Aviso que se da al guardar, del catalogo de Produccion. La pagina lo pasa con su
   * clave literal para que notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Lista de materiales a la que vuelve al guardar o cancelar. */
  returnTo: string;
  /** Avisos de la pagina o el panel, dentro del cuerpo del formulario. */
  notices?: ReactNode;
  disabled?: boolean;
};

const initialState: RecipeDetailFormState = { status: "idle" };

const DEFAULT_PREVIEW_QUANTITY = "10";

const emptyValues: RecipeDetailFormValues = {
  id_material: "",
  cantidad_requerida: "",
  merma_estimada_porcentaje: "",
  tipo_consumo: "",
  observaciones: "",
};

// Formulario de alta y edicion de lineas de receta (entrega 10.6b), con el patron
// de Etapas. La accion devuelve un resultado: con error, ActionForm vuelve a mostrar
// lo enviado y enfoca el primer campo invalido, y el mensaje general queda dentro
// del formulario, sin toast; con exito, se da un solo aviso y se vuelve a la lista.
// Material, cantidad y merma son estado del formulario porque alimentan el simulador:
// con value son controlados y sobreviven al remontaje de los campos.
//
// El simulador no se guarda: su campo no tiene name y corta su evento input, asi que
// tocarlo no cuenta como un cambio que el panel deba preguntar si se descarta.
export function RecipeDetailForm({
  action,
  versionId,
  materials,
  defaultValues,
  submitLabel,
  successNotification,
  returnTo,
  notices,
  disabled = false,
}: RecipeDetailFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);

  const [materialId, setMaterialId] = useState(defaultValues?.id_material ?? "");
  const [quantity, setQuantity] = useState(defaultValues?.cantidad_requerida ?? "");
  const [waste, setWaste] = useState(defaultValues?.merma_estimada_porcentaje ?? "");
  const [previewQuantity, setPreviewQuantity] = useState(DEFAULT_PREVIEW_QUANTITY);

  const values = state.status === "idle" ? { ...emptyValues, ...defaultValues } : state.values;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const materialErrors = fieldErrors?.id_material;

  const goBack = useCallback(() => router.push(returnTo), [router, returnTo]);

  // Un aviso por operacion; en el panel lo cierra y en la pagina vuelve a la lista.
  useFormResult(state, pending, { successNotification, onSuccess: goBack });

  const resultKey = state.status === "idle" ? undefined : state.operationId;

  const selectedMaterial = materials.find((material) => material.id === materialId);
  const unit = selectedMaterial?.unidad_medida ?? "";

  const perUnitWithWaste = roundQuantity(applyWaste(quantity, waste));
  const totalRequired = roundQuantity(
    calculateRequiredQuantity({
      quantityPerUnit: quantity,
      wastePercentage: waste,
      orderQuantity: previewQuantity,
    }),
  );

  const showPreview = Number(quantity) > 0;

  const fields = (
    <>
      <input type="hidden" name="id_version_receta" value={versionId} />

      {defaultValues?.id_detalle_receta ? (
        <input type="hidden" name="id_detalle_receta" value={defaultValues.id_detalle_receta} />
      ) : null}

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {notices}

      <div className="space-y-2">
        <SearchableSelect
          id="id_material"
          name="id_material"
          label="Material o insumo"
          placeholder="Buscar material..."
          items={materials}
          value={materialId}
          onValueChange={setMaterialId}
          required
          disabled={disabled}
          emptyMessage="No hay materiales disponibles para esta receta."
          {...(materialErrors?.length
            ? { "aria-invalid": true as const, "aria-describedby": "id_material-error" }
            : {})}
        />

        <p className="text-xs text-muted-foreground">
          La unidad de medida se toma automáticamente desde el material registrado en inventario.
        </p>

        <FieldError id="id_material-error" messages={materialErrors} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field
          id="cantidad_requerida"
          label="Cantidad requerida por unidad"
          required
          disabled={disabled}
          errors={fieldErrors?.cantidad_requerida}
          description={
            <>
              Consumo para fabricar <strong>una</strong> unidad del producto
              {unit ? ` (en ${unit})` : ""}.
            </>
          }
        >
          {(control) => (
            <Input
              {...control}
              name="cantidad_requerida"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Ej. 2.50"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          )}
        </Field>

        <Field
          id="merma_estimada_porcentaje"
          label="Merma estimada (%)"
          disabled={disabled}
          errors={fieldErrors?.merma_estimada_porcentaje}
          description="Material que se pierde en el proceso. Aumenta lo que hay que sacar del almacén."
        >
          {(control) => (
            <Input
              {...control}
              name="merma_estimada_porcentaje"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="Ej. 5"
              value={waste}
              onChange={(event) => setWaste(event.target.value)}
            />
          )}
        </Field>
      </div>

      {showPreview ? (
        <div className="space-y-3 rounded-lg border border-border/80 bg-secondary/40 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field id="preview_quantity" label="Simular para una orden de">
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min="1"
                  step="1"
                  className="w-32"
                  value={previewQuantity}
                  onChange={(event) => setPreviewQuantity(event.target.value)}
                  onInput={(event) => event.stopPropagation()}
                />
              )}
            </Field>
            <p className="pb-2 text-sm text-muted-foreground">unidades</p>
          </div>

          <div className="rounded-lg border border-border/80 bg-card p-3 text-sm">
            <ul className="space-y-1 text-muted-foreground">
              <li>
                Consumo por unidad con merma:{" "}
                <span className="font-medium text-foreground">
                  {perUnitWithWaste.toFixed(2)} {unit}
                </span>
              </li>
              <li>
                Requerimiento total:{" "}
                <span className="font-medium text-foreground">
                  {totalRequired.toFixed(2)} {unit}
                </span>
              </li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            Cálculo de referencia. No se guarda: sirve para verificar que la cantidad por unidad es la correcta.
          </p>
        </div>
      ) : null}

      <Field
        id="tipo_consumo"
        label="Tipo de consumo"
        required
        disabled={disabled}
        errors={fieldErrors?.tipo_consumo}
      >
        {(control) => (
          <NativeSelect {...control} name="tipo_consumo" defaultValue={values.tipo_consumo}>
            <option value="">Seleccione el tipo</option>
            <option value="materia_prima">Materia prima</option>
            <option value="consumible">Consumible</option>
            <option value="auxiliar">Auxiliar</option>
          </NativeSelect>
        )}
      </Field>

      <Field id="observaciones" label="Observaciones" disabled={disabled} errors={fieldErrors?.observaciones}>
        {(control) => (
          <Textarea
            {...control}
            name="observaciones"
            rows={4}
            maxLength={700}
            placeholder="Ej. Considerar margen adicional si la plancha viene con cortes irregulares."
            defaultValue={values.observaciones}
          />
        )}
      </Field>
    </>
  );

  if (panel) {
    return (
      <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="space-y-4">{fields}</SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={panel.requestClose}>
            Cancelar
          </Button>
          <SubmitButton pendingText="Guardando..." disabled={disabled}>
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
      className="space-y-5 rounded-lg border border-border/80 bg-card p-6"
    >
      {fields}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Guardando..." disabled={disabled}>
          {submitLabel}
        </SubmitButton>

        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
