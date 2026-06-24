import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createFabricationRouteAction } from "@/modules/production/routes/actions";

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/access-denied");
  }
}

export default async function NewFabricationRoutePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const products = await prisma.producto.findMany({
    where: {
      estado: true,
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

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">
          Producción · Rutas de fabricación
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Nueva ruta de fabricación
        </h1>

        <p className="text-slate-600">
          Registra una ruta productiva para un producto. Luego agregaremos sus
          etapas: corte, forjado, soldadura, lijado, pintura u otras.
        </p>
      </section>

      {products.length === 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          No hay productos activos registrados. Primero registra productos en el
          módulo comercial para poder crear rutas de fabricación.
        </section>
      ) : null}

      <form
        action={createFabricationRouteAction}
        className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Producto *</label>

          <select
            name="id_producto"
            required
            disabled={products.length === 0}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          >
            <option value="">Seleccione un producto</option>

            {products.map((product) => (
              <option key={product.id_producto} value={product.id_producto}>
                {product.nombre_producto} · {product.categoria}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Nombre de la ruta *</label>

          <input
            name="nombre_ruta"
            required
            maxLength={100}
            placeholder="Ej. Ruta estándar para lampa"
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Descripción</label>

          <textarea
            name="descripcion"
            rows={4}
            maxLength={500}
            placeholder="Ej. Corte de plancha, formado, soldadura, lijado y pintura."
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Importante</p>
          <p className="mt-1">
            En esta pantalla solo registramos la ruta general. Las etapas
            ordenadas de la ruta se crearán en la Fase 4.2.
          </p>
        </div>

        <div className="flex items-center justify-between pt-4">
          <Link
            href="/dashboard/production/routes"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={products.length === 0}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Guardar ruta
          </button>
        </div>
      </form>
    </main>
  );
}