import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { prisma } from "@/lib/db";
import { updateFabricationRouteAction } from "@/modules/production/routes/actions";

type EditFabricationRoutePageProps = {
  params: Promise<{
    id: string;
  }>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

export default async function EditFabricationRoutePage({
  params,
}: EditFabricationRoutePageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const { id } = await params;

  const [route, products] = await Promise.all([
    prisma.ruta_fabricacion.findUnique({
      where: {
        id_ruta: id,
      },
      include: {
        producto: true,
        _count: {
          select: {
            orden_trabajo: true,
          },
        },
      },
    }),
    prisma.producto.findMany({
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
    }),
  ]);

  if (!route) {
    notFound();
  }

  const productItems = products.map((product) => ({
    id: product.id_producto,
    label: product.nombre_producto,
    description: `${product.categoria} - ${product.unidad_medida}`,
  }));

  const productLocked = route._count.orden_trabajo > 0;

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">
          Produccion - Rutas de fabricacion
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Editar ruta de fabricacion
        </h1>

        <p className="text-slate-600">
          Actualiza los datos generales de la ruta. Si ya tiene ordenes
          asociadas, el producto queda protegido para conservar trazabilidad.
        </p>
      </section>

      <form
        action={updateFabricationRouteAction}
        className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="id_ruta" value={route.id_ruta} />

        {productLocked ? (
          <>
            <input
              type="hidden"
              name="id_producto"
              value={route.id_producto}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Producto</label>
              <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {route.producto.nombre_producto}
              </div>
              <p className="text-xs text-slate-500">
                Esta ruta tiene ordenes asociadas; el producto no se puede
                cambiar desde datos maestros productivos.
              </p>
            </div>
          </>
        ) : (
          <SearchableSelect
            name="id_producto"
            label="Producto"
            placeholder="Buscar producto..."
            items={productItems}
            value={route.id_producto}
            required
            emptyMessage="No hay productos activos disponibles."
          />
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Nombre de la ruta *</label>

          <input
            name="nombre_ruta"
            required
            maxLength={100}
            defaultValue={route.nombre_ruta}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Descripcion</label>

          <textarea
            name="descripcion"
            rows={4}
            maxLength={500}
            defaultValue={route.descripcion ?? ""}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="flex items-center justify-between pt-4">
          <Link
            href="/dashboard/production/routes"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Volver a rutas
          </Link>

          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </main>
  );
}
