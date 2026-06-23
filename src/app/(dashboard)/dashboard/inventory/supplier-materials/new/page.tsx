import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createSupplierMaterialAction } from "@/modules/inventory/supplier-materials/actions";

export default async function NewSupplierMaterialPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/access-denied");
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

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">
          Inventario · Proveedor-material
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Nueva asociación
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
          <label className="text-sm font-medium">Proveedor *</label>
          <select
            name="id_proveedor"
            required
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="">Seleccione un proveedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id_proveedor} value={supplier.id_proveedor}>
                {supplier.razon_social}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Material *</label>
          <select
            name="id_material"
            required
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="">Seleccione un material</option>
            {materials.map((material) => (
              <option key={material.id_material} value={material.id_material}>
                {material.nombre_material} · {material.unidad_medida}
              </option>
            ))}
          </select>
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
              Tiempo de entrega en días
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
            Guardar asociación
          </button>
        </div>
      </form>
    </main>
  );
}