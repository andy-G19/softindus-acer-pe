"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { createPurchaseAction } from "@/modules/inventory/purchases/actions";

type MaterialOption = {
  id_material: string;
  nombre_material: string;
  unidad_medida: string;
  costo_unitario_actual: string;
};

type SupplierOption = {
  id_proveedor: string;
  razon_social: string;
};

type PurchaseItem = {
  id: number;
  id_material: string;
  cantidad: string;
  unidad_medida: string;
  costo_unitario: string;
  observaciones: string;
};

type PurchaseFormProps = {
  suppliers: SupplierOption[];
  materials: MaterialOption[];
};

export function PurchaseForm({ suppliers, materials }: PurchaseFormProps) {
  const [items, setItems] = useState<PurchaseItem[]>([
    {
      id: 1,
      id_material: "",
      cantidad: "1",
      unidad_medida: "",
      costo_unitario: "0",
      observaciones: "",
    },
  ]);

  const supplierItems = useMemo(() => {
    return suppliers.map((supplier) => ({
      id: supplier.id_proveedor,
      label: supplier.razon_social,
    }));
  }, [suppliers]);

  const materialItems = useMemo(() => {
    return materials.map((material) => ({
      id: material.id_material,
      label: material.nombre_material,
      description: `${material.unidad_medida} - S/ ${Number(
        material.costo_unitario_actual,
      ).toFixed(2)}`,
    }));
  }, [materials]);

  const total = useMemo(() => {
    return items.reduce((acc, item) => {
      const quantity = Number(item.cantidad || 0);
      const unitCost = Number(item.costo_unitario || 0);

      return acc + quantity * unitCost;
    }, 0);
  }, [items]);

  function addItem() {
    setItems((currentItems) => {
      const nextId =
        currentItems.length > 0
          ? Math.max(...currentItems.map((item) => item.id)) + 1
          : 1;

      return [
        ...currentItems,
        {
          id: nextId,
          id_material: "",
          cantidad: "1",
          unidad_medida: "",
          costo_unitario: "0",
          observaciones: "",
        },
      ];
    });
  }

  function removeItem(id: number) {
    setItems((currentItems) => {
      if (currentItems.length === 1) {
        return currentItems;
      }

      return currentItems.filter((item) => item.id !== id);
    });
  }

  function updateItem(id: number, field: keyof PurchaseItem, value: string) {
    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== id) {
          return item;
        }

        if (field === "id_material") {
          const selectedMaterial = materials.find(
            (material) => material.id_material === value,
          );

          return {
            ...item,
            id_material: value,
            unidad_medida: selectedMaterial?.unidad_medida ?? "",
            costo_unitario: selectedMaterial?.costo_unitario_actual ?? "0",
          };
        }

        return {
          ...item,
          [field]: value,
        };
      }),
    );
  }

  return (
    <form action={createPurchaseAction} className="space-y-6">
      <section className="space-y-5 rounded-xl border bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <SearchableSelect
            name="id_proveedor"
            label="Proveedor"
            placeholder="Buscar proveedor..."
            items={supplierItems}
            required
            emptyMessage="No hay proveedores activos."
          />
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha de compra *</label>
            <input
              name="fecha_compra"
              type="date"
              required
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo comprobante</label>
            <select
              name="tipo_comprobante"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">Sin comprobante</option>
              <option value="boleta">Boleta</option>
              <option value="factura">Factura</option>
              <option value="recibo">Recibo</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Nro. comprobante</label>
            <input
              name="numero_comprobante"
              placeholder="Ej. F001-000123"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">IGV</label>
            <input
              name="igv"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Observaciones</label>
            <input
              name="observaciones"
              placeholder="Observaciones generales de la compra"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Materiales comprados</h2>
            <p className="text-sm text-slate-600">
              Agrega uno o varios materiales dentro de la compra.
            </p>
          </div>

          <button
            type="button"
            onClick={addItem}
            className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Agregar material
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => {
            const subtotal =
              Number(item.cantidad || 0) * Number(item.costo_unitario || 0);

            return (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-medium">Material #{index + 1}</p>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    Quitar
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <SearchableSelect
                      name="id_material"
                      label="Material"
                      placeholder="Buscar material..."
                      items={materialItems}
                      value={item.id_material}
                      required
                      emptyMessage="No hay materiales activos."
                      onValueChange={(value) =>
                        updateItem(item.id, "id_material", value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unidad *</label>
                    <input
                      name="unidad_medida"
                      required
                      value={item.unidad_medida}
                      onChange={(event) =>
                        updateItem(item.id, "unidad_medida", event.target.value)
                      }
                      className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cantidad *</label>
                    <input
                      name="cantidad"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={item.cantidad}
                      onChange={(event) =>
                        updateItem(item.id, "cantidad", event.target.value)
                      }
                      className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Costo unitario *
                    </label>
                    <input
                      name="costo_unitario"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={item.costo_unitario}
                      onChange={(event) =>
                        updateItem(item.id, "costo_unitario", event.target.value)
                      }
                      className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subtotal</label>
                    <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm font-medium">
                      S/ {subtotal.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="text-sm font-medium">
                    Observacion del material
                  </label>
                  <input
                    name="item_observaciones"
                    value={item.observaciones}
                    onChange={(event) =>
                      updateItem(item.id, "observaciones", event.target.value)
                    }
                    className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg bg-slate-50 p-4 text-right">
          <p className="text-sm text-slate-600">Subtotal calculado</p>
          <p className="text-2xl font-bold">S/ {total.toFixed(2)}</p>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/inventory/purchases"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Cancelar
        </Link>

        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Registrar compra y entrada
        </button>
      </div>
    </form>
  );
}
