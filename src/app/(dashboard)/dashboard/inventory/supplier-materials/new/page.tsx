import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { prisma } from "@/lib/db";
import { createSupplierMaterialAction } from "@/modules/inventory/supplier-materials/actions";

export default async function NewSupplierMaterialPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  const [suppliers, materials] = await Promise.all([
    prisma.proveedor.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        razon_social: "asc",
      },
    }),
    prisma.material.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_material: "asc",
      },
    }),
  ]);

  const supplierItems = suppliers.map((supplier) => ({
    id: supplier.id_proveedor,
    label: supplier.razon_social,
  }));

  const materialItems = materials.map((material) => ({
    id: material.id_material,
    label: material.nombre_material,
    description: material.unidad_medida,
  }));

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">
          Inventario - Proveedor-material
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Nueva asociacion
        </h1>
        <p className="text-slate-600">
          Vincula un proveedor con el material o insumo que puede abastecer.
        </p>
      </section>

      <form
        action={createSupplierMaterialAction}
        className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
      >
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

        <div className="space-y-2">
          <SearchableSelect
            name="id_material"
            label="Material"
            placeholder="Buscar material..."
            items={materialItems}
            required
            emptyMessage="No hay materiales activos."
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Unidad de compra *</label>
            <input
              name="unidad_medida"
              required
              placeholder="Ej. kg, unidad, plancha, metro"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Precio referencial</label>
            <input
              name="precio_referencial"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Tiempo de entrega en dias
            </label>
            <input
              name="tiempo_entrega_dias"
              type="number"
              min="0"
              placeholder="Ej. 2"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Disponibilidad</label>
            <select
              name="disponibilidad"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">No especificado</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
              <option value="no_disponible">No disponible</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <Link
            href="/dashboard/inventory/supplier-materials"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Guardar asociacion
          </button>
        </div>
      </form>
    </main>
  );
}
