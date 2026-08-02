"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { showError } from "@/lib/notifications";
import {
  applyWaste,
  calculateRequiredQuantity,
  roundQuantity,
} from "@/lib/recipe-quantities";
import type { RecipeDetailFormState } from "@/modules/production/recipe-details/actions";

export type RecipeDetailMaterialOption = {
  id: string;
  label: string;
  description?: string;
  unidad_medida: string;
};

type RecipeDetailValues = {
  id_detalle_receta?: string;
  id_material: string;
  cantidad_requerida: string;
  merma_estimada_porcentaje: string;
  tipo_consumo: string;
  observaciones: string;
};

type RecipeDetailFormProps = {
  action: (
    prevState: RecipeDetailFormState,
    formData: FormData,
  ) => Promise<RecipeDetailFormState>;
  versionId: string;
  backHref: string;
  materials: RecipeDetailMaterialOption[];
  defaultValues?: Partial<RecipeDetailValues>;
  submitLabel: string;
  disabled?: boolean;
};

const initialState: RecipeDetailFormState = { error: "" };

const DEFAULT_PREVIEW_QUANTITY = "10";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function RecipeDetailForm({
  action,
  versionId,
  backHref,
  materials,
  defaultValues,
  submitLabel,
  disabled = false,
}: RecipeDetailFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [materialId, setMaterialId] = useState(defaultValues?.id_material ?? "");
  const [quantity, setQuantity] = useState(
    defaultValues?.cantidad_requerida ?? "",
  );
  const [waste, setWaste] = useState(
    defaultValues?.merma_estimada_porcentaje ?? "",
  );
  const [previewQuantity, setPreviewQuantity] = useState(
    DEFAULT_PREVIEW_QUANTITY,
  );

  useEffect(() => {
    if (state.error) {
      showError("No se pudo guardar el material", state.error);
    }
  }, [state.error]);

  const selectedMaterial = materials.find(
    (material) => material.id === materialId,
  );
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

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
    >
      <input type="hidden" name="id_version_receta" value={versionId} />

      {defaultValues?.id_detalle_receta ? (
        <input
          type="hidden"
          name="id_detalle_receta"
          value={defaultValues.id_detalle_receta}
        />
      ) : null}

      {state.error ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <SearchableSelect
          name="id_material"
          label="Material o insumo"
          placeholder="Buscar material..."
          items={materials}
          value={materialId}
          onValueChange={setMaterialId}
          required
          disabled={disabled}
          emptyMessage="No hay materiales disponibles para esta receta."
        />

        <p className="text-xs text-muted-foreground">
          La unidad de medida se toma automáticamente desde el material
          registrado en inventario.
        </p>

        <FieldError messages={state.fieldErrors?.id_material} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cantidad_requerida">
            Cantidad requerida por unidad *
          </Label>
          <Input
            id="cantidad_requerida"
            name="cantidad_requerida"
            type="number"
            min="0.01"
            step="0.01"
            required
            disabled={disabled}
            placeholder="Ej. 2.50"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Consumo para fabricar <strong>una</strong> unidad del producto
            {unit ? ` (en ${unit})` : ""}.
          </p>
          <FieldError messages={state.fieldErrors?.cantidad_requerida} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="merma_estimada_porcentaje">
            Merma estimada (%)
          </Label>
          <Input
            id="merma_estimada_porcentaje"
            name="merma_estimada_porcentaje"
            type="number"
            min="0"
            max="100"
            step="0.01"
            disabled={disabled}
            placeholder="Ej. 5"
            value={waste}
            onChange={(event) => setWaste(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Material que se pierde en el proceso. Aumenta lo que hay que sacar
            del almacén.
          </p>
          <FieldError
            messages={state.fieldErrors?.merma_estimada_porcentaje}
          />
        </div>
      </div>

      {showPreview ? (
        <div className="space-y-3 rounded-lg border border-border/80 bg-secondary/40 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="preview_quantity">
                Simular para una orden de
              </Label>
              <Input
                id="preview_quantity"
                type="number"
                min="1"
                step="1"
                className="w-32"
                value={previewQuantity}
                onChange={(event) => setPreviewQuantity(event.target.value)}
              />
            </div>
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
            Cálculo de referencia. No se guarda: sirve para verificar que la
            cantidad por unidad es la correcta.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="tipo_consumo">Tipo de consumo *</Label>
        <NativeSelect
          id="tipo_consumo"
          name="tipo_consumo"
          required
          disabled={disabled}
          defaultValue={defaultValues?.tipo_consumo ?? ""}
        >
          <option value="">Seleccione el tipo</option>
          <option value="materia_prima">Materia prima</option>
          <option value="consumible">Consumible</option>
          <option value="auxiliar">Auxiliar</option>
        </NativeSelect>
        <FieldError messages={state.fieldErrors?.tipo_consumo} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="observaciones">Observaciones</Label>
        <Textarea
          id="observaciones"
          name="observaciones"
          rows={4}
          maxLength={700}
          disabled={disabled}
          placeholder="Ej. Considerar margen adicional si la plancha viene con cortes irregulares."
          defaultValue={defaultValues?.observaciones ?? ""}
        />
        <FieldError messages={state.fieldErrors?.observaciones} />
      </div>

      <div className="flex items-center justify-between pt-4">
        <Button variant="link" className="h-auto p-0" asChild>
          <Link href={backHref}>Cancelar</Link>
        </Button>

        <Button type="submit" disabled={disabled || isPending}>
          {isPending ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
