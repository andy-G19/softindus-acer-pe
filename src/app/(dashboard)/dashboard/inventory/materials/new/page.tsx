import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createMaterialAction } from "@/modules/inventory/materials/actions";

export default async function NewMaterialPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">
          Inventario · Materiales
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Nuevo material</h1>
        <p className="text-slate-600">
          Registra materia prima, consumibles, repuestos, herramientas u otros
          insumos del taller.
        </p>
      </section>

      <form action={createMaterialAction} className="space-y-5 rounded-xl border bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium">Nombre del material *</label>
          <input
            name="nombre_material"
            required
            placeholder="Ej. Plancha metálica 1/20"
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Categoría *</label>
            <select
              name="categoria"
              required
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="materia_prima">Materia prima</option>
              <option value="consumible">Consumible</option>
              <option value="repuesto">Repuesto</option>
              <option value="herramienta">Herramienta</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Unidad de medida *</label>
            <input
              name="unidad_medida"
              required
              placeholder="Ej. kg, unidad, metro, plancha"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Stock actual *</label>
            <input
              name="stock_actual"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
              required
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Stock reservado *</label>
            <input
              name="stock_reservado"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
              required
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Stock mínimo *</label>
            <input
              name="stock_minimo"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
              required
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Costo unitario actual *</label>
            <input
              name="costo_unitario_actual"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
              required
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <Link
            href="/dashboard/inventory/materials"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Guardar material
          </button>
        </div>
      </form>
    </main>
  );
}