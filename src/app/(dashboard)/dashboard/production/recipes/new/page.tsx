import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { prisma } from "@/lib/db";
import { createTechnicalRecipeAction } from "@/modules/production/recipes/actions";

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

export default async function NewTechnicalRecipePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const products = await prisma.producto.findMany({
    where: {
      estado: true,
    },
    include: {
      receta_tecnica: {
        select: {
          id_receta: true,
          nombre_receta: true,
          estado: true,
        },
      },
    },
    orderBy: [
      {
        categoria: "asc",
      },
      {
        nombre_producto: "asc",
      },
    ],
  });

  const productItems = products.map((product) => ({
    id: product.id_producto,
    label: product.nombre_producto,
    description: `${product.categoria} - ${product.unidad_medida}`,
  }));

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">
          Produccion - Recetas tecnicas
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Nueva receta tecnica
        </h1>

        <p className="mt-2 text-slate-600">
          Registra la receta tecnica base de un producto. Luego agregaremos
          versiones y materiales requeridos.
        </p>
      </section>

      {products.length === 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          No hay productos activos registrados. Primero registra productos en el
          modulo comercial para poder crear recetas tecnicas.
        </section>
      ) : null}

      <form
        action={createTechnicalRecipeAction}
        className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
      >
        <div className="space-y-2">
          <SearchableSelect
            name="id_producto"
            label="Producto"
            placeholder="Buscar producto..."
            items={productItems}
            required
            disabled={products.length === 0}
            emptyMessage="No hay productos activos."
          />

          <p className="text-xs text-slate-500">
            Puedes tener mas de una receta por producto siempre que el nombre de
            la receta sea diferente.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Nombre de la receta *</label>

          <input
            name="nombre_receta"
            required
            maxLength={100}
            placeholder="Ej. Receta tecnica estandar para lampa"
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Descripcion tecnica</label>

          <textarea
            name="descripcion"
            rows={5}
            maxLength={700}
            placeholder="Ej. Receta base para fabricar lampas metalicas considerando materiales principales, consumibles y procesos estandar."
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Importante</p>

          <p className="mt-1">
            En esta pantalla solo registramos la cabecera de la receta tecnica.
            En la siguiente subfase agregaremos la version inicial de la receta.
            Despues registraremos los materiales, cantidades, unidad de medida,
            tipo de consumo y merma estimada.
          </p>
        </div>

        <div className="flex items-center justify-between pt-4">
          <Link
            href="/dashboard/production/recipes"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={products.length === 0}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Guardar receta
          </button>
        </div>
      </form>
    </main>
  );
}
