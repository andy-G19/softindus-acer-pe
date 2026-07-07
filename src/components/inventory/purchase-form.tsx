"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
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
      <section className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm">
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
            <Label>Fecha de compra *</Label>
            <Input name="fecha_compra" type="date" required />
          </div>

          <div className="space-y-2">
            <Label>Tipo comprobante</Label>
            <NativeSelect name="tipo_comprobante">
              <option value="">Sin comprobante</option>
              <option value="boleta">Boleta</option>
              <option value="factura">Factura</option>
              <option value="recibo">Recibo</option>
              <option value="otro">Otro</option>
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label>Nro. comprobante</Label>
            <Input name="numero_comprobante" placeholder="Ej. F001-000123" />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label>IGV</Label>
            <Input
              name="igv"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
            />
          </div>

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Input
              name="observaciones"
              placeholder="Observaciones generales de la compra"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border/80 bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Materiales comprados
            </h2>
            <p className="text-sm text-muted-foreground">
              Agrega uno o varios materiales dentro de la compra.
            </p>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            Agregar material
          </Button>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => {
            const subtotal =
              Number(item.cantidad || 0) * Number(item.costo_unitario || 0);

            return (
              <div
                key={item.id}
                className="rounded-lg border border-border/80 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-medium">Material #{index + 1}</p>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    Quitar
                  </Button>
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
                    <Label>Unidad *</Label>
                    <Input
                      name="unidad_medida"
                      required
                      value={item.unidad_medida}
                      onChange={(event) =>
                        updateItem(item.id, "unidad_medida", event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Cantidad *</Label>
                    <Input
                      name="cantidad"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={item.cantidad}
                      onChange={(event) =>
                        updateItem(item.id, "cantidad", event.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Costo unitario *</Label>
                    <Input
                      name="costo_unitario"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={item.costo_unitario}
                      onChange={(event) =>
                        updateItem(item.id, "costo_unitario", event.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Subtotal</Label>
                    <div className="flex h-8 items-center rounded-lg border border-input bg-muted px-2.5 text-sm font-medium">
                      S/ {subtotal.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Label>Observacion del material</Label>
                  <Input
                    name="item_observaciones"
                    value={item.observaciones}
                    onChange={(event) =>
                      updateItem(item.id, "observaciones", event.target.value)
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg bg-muted p-4 text-right">
          <p className="text-sm text-muted-foreground">Subtotal calculado</p>
          <p className="text-2xl font-bold">S/ {total.toFixed(2)}</p>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <Button variant="link" className="h-auto p-0" asChild>
          <Link href="/dashboard/inventory/purchases">Cancelar</Link>
        </Button>

        <Button type="submit">Registrar compra y entrada</Button>
      </div>
    </form>
  );
}
