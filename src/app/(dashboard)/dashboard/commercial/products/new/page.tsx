import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createProductAction } from "@/modules/commercial/products/actions";

export default async function NewProductPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Nuevo producto</h1>
        <p className="text-sm text-muted-foreground">
          Registra productos como lampas, rastrillos, trípodes u otros productos
          fabricados por el taller.
        </p>
      </div>

      <form
        action={createProductAction}
        className="space-y-4 rounded-lg border p-6"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Nombre del producto</label>
          <input
            name="nombre_producto"
            placeholder="Ejemplo: Lampa agrícola reforzada"
            className="w-full rounded-md border px-3 py-2"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Categoría</label>
          <select
            name="categoria"
            className="w-full rounded-md border px-3 py-2"
            required
          >
            <option value="lampa">Lampa</option>
            <option value="rastrillo">Rastrillo</option>
            <option value="tripode">Trípode</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Unidad de medida</label>
          <select
            name="unidad_medida"
            className="w-full rounded-md border px-3 py-2"
            required
          >
            <option value="unidad">Unidad</option>
            <option value="docena">Docena</option>
            <option value="par">Par</option>
            <option value="lote">Lote</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Precio referencial</label>
          <input
            name="precio_referencial"
            type="number"
            step="0.01"
            min="0"
            placeholder="Ejemplo: 35.00"
            className="w-full rounded-md border px-3 py-2"
          />
          <p className="text-xs text-muted-foreground">
            Este precio es referencial. Más adelante se calculará mejor con el
            módulo de costos.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Descripción</label>
          <textarea
            name="descripcion"
            placeholder="Describe características principales del producto."
            className="min-h-24 w-full rounded-md border px-3 py-2"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Guardar producto
          </button>

          <Link
            href="/dashboard/commercial/products"
            className="rounded-md border px-4 py-2 text-sm font-medium"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </main>
  );
}