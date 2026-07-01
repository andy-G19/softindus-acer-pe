"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { createRecipeVersionAction } from "@/modules/production/recipe-versions/actions";

type MaterialOption = {
  id_material: string;
  nombre_material: string;
  categoria: string;
  unidad_medida: string;
  costo_unitario_actual: string;
};

type VersionDetailDraft = {
  key: string;
  id_material: string;
  cantidad_requerida: string;
  tipo_consumo: string;
  merma_estimada_porcentaje: string;
  observaciones: string;
};

type RecipeVersionFormProps = {
  idReceta: string;
  backHref: string;
  materials: MaterialOption[];
  initialDetails?: VersionDetailDraft[];
  canCreateVersion: boolean;
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

export function RecipeVersionForm({
  idReceta,
  backHref,
  materials,
  initialDetails = [],
  canCreateVersion,
}: RecipeVersionFormProps) {
  const [nextKey, setNextKey] = useState(
    Math.max(initialDetails.length + 1, 2),
  );
  const [details, setDetails] = useState<VersionDetailDraft[]>(
    initialDetails.length > 0 ? initialDetails : [createEmptyDetail("row-1")],
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );

  const materialItems = useMemo(() => {
    return materials.map((material) => ({
      id: material.id_material,
      label: material.nombre_material,
      description: `${material.categoria} - ${material.unidad_medida} - S/ ${Number(
        material.costo_unitario_actual,
      ).toFixed(2)}`,
    }));
  }, [materials]);

  function addDetail() {
    setDetails((currentDetails) => [
      ...currentDetails,
      createEmptyDetail(`row-${nextKey}`),
    ]);
    setNextKey((currentKey) => currentKey + 1);
  }

  function removeDetail(key: string) {
    setDetails((currentDetails) => {
      if (currentDetails.length === 1) {
        return currentDetails;
      }

      return currentDetails.filter((detail) => detail.key !== key);
    });
  }

  function updateDetail(
    key: string,
    field: keyof VersionDetailDraft,
    value: string,
  ) {
    setDetails((currentDetails) =>
      currentDetails.map((detail) => {
        if (detail.key !== key) {
          return detail;
        }

        return {
          ...detail,
          [field]: value,
        };
      }),
    );
    setValidationMessage(null);
  }

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    setValidationMessage(null);

    if (!canCreateVersion || materials.length === 0) {
      event.preventDefault();
      setValidationMessage("No hay datos suficientes para crear la versión.");
      return;
    }

    const selectedMaterials = details
      .map((detail) => detail.id_material)
      .filter(Boolean);

    if (selectedMaterials.length !== details.length) {
      event.preventDefault();
      setValidationMessage("Seleccione un material en cada fila.");
      return;
    }

    if (new Set(selectedMaterials).size !== selectedMaterials.length) {
      event.preventDefault();
      setValidationMessage("No se permite duplicar materiales en la versión.");
      return;
    }

    const invalidQuantity = details.some((detail) => {
      return Number(detail.cantidad_requerida) <= 0;
    });

    if (invalidQuantity) {
      event.preventDefault();
      setValidationMessage("Las cantidades deben ser mayores a cero.");
    }
  }

  return (
    <form
      action={createRecipeVersionAction}
      onSubmit={validateBeforeSubmit}
      className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
    >
      <input type="hidden" name="id_receta" value={idReceta} />

      {validationMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {validationMessage}
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-sm font-medium">Motivo o descripción</label>

        <textarea
          name="motivo_cambio"
          rows={4}
          maxLength={700}
          defaultValue="Nueva versión de receta técnica."
          placeholder="Ej. Ajuste de materiales por cambio de proveedor o mejora de proceso."
          disabled={!canCreateVersion}
          className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
        />
      </div>

      <section className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="font-semibold">Materiales de la versión</h2>
            <p className="text-sm text-slate-500">
              La nueva versión quedará vigente y reemplazará la versión vigente
              anterior.
            </p>
          </div>

          <button
            type="button"
            onClick={addDetail}
            disabled={!canCreateVersion}
            className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Agregar material
          </button>
        </div>

        <div className="space-y-4">
          {details.map((detail, index) => (
            <div key={detail.key} className="rounded-lg border p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Material {index + 1}
                </h3>

                <button
                  type="button"
                  onClick={() => removeDetail(detail.key)}
                  disabled={details.length === 1}
                  className="text-sm font-medium text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Quitar
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-[1.4fr_0.7fr_0.8fr_0.7fr]">
                <SearchableSelect
                  name="id_material"
                  label="Material"
                  placeholder="Buscar material..."
                  items={materialItems}
                  value={detail.id_material}
                  required
                  disabled={!canCreateVersion}
                  emptyMessage="No hay materiales activos."
                  onValueChange={(value) =>
                    updateDetail(detail.key, "id_material", value)
                  }
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium">Cantidad *</label>
                  <input
                    name="cantidad_requerida"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={detail.cantidad_requerida}
                    disabled={!canCreateVersion}
                    onChange={(event) =>
                      updateDetail(
                        detail.key,
                        "cantidad_requerida",
                        event.target.value,
                      )
                    }
                    className="h-9 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo *</label>
                  <select
                    name="tipo_consumo"
                    required
                    value={detail.tipo_consumo}
                    disabled={!canCreateVersion}
                    onChange={(event) =>
                      updateDetail(
                        detail.key,
                        "tipo_consumo",
                        event.target.value,
                      )
                    }
                    className="h-9 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
                  >
                    <option value="materia_prima">Materia prima</option>
                    <option value="consumible">Consumible</option>
                    <option value="auxiliar">Auxiliar</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Merma %</label>
                  <input
                    name="merma_estimada_porcentaje"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={detail.merma_estimada_porcentaje}
                    disabled={!canCreateVersion}
                    onChange={(event) =>
                      updateDetail(
                        detail.key,
                        "merma_estimada_porcentaje",
                        event.target.value,
                      )
                    }
                    className="h-9 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <label className="text-sm font-medium">Observaciones</label>
                <input
                  name="observaciones_detalle"
                  value={detail.observaciones}
                  disabled={!canCreateVersion}
                  onChange={(event) =>
                    updateDetail(
                      detail.key,
                      "observaciones",
                      event.target.value,
                    )
                  }
                  placeholder="Observación opcional del material."
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between pt-4">
        <Link
          href={backHref}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Cancelar
        </Link>

        <button
          type="submit"
          disabled={!canCreateVersion}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Crear versión vigente
        </button>
      </div>
    </form>
  );
}
