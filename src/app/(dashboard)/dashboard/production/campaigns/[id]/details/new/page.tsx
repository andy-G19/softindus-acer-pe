import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { addCampaignDetailAction } from "@/modules/production/campaigns/actions";

type NewCampaignDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

export default async function NewCampaignDetailPage({
  params,
}: NewCampaignDetailPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const { id } = await params;

  const campaign = await prisma.campania_produccion.findUnique({
    where: {
      id_campania: id,
    },
    include: {
      campania_detalle: {
        select: {
          id_producto: true,
        },
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  const isClosedCampaign = ["finalizada", "anulada"].includes(campaign.estado);
  const existingProductIds = campaign.campania_detalle.map(
    (detail) => detail.id_producto,
  );

  const products = await prisma.producto.findMany({
    where: {
      estado: true,
      id_producto:
        existingProductIds.length > 0
          ? {
              notIn: existingProductIds,
            }
          : undefined,
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
          Produccion · Campanias · Productos
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Agregar producto a campania
        </h1>

        <p className="text-slate-600">
          Campania:{" "}
          <span className="font-medium">{campaign.nombre_campania}</span>
        </p>
      </section>

      {isClosedCampaign ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Esta campania esta finalizada o anulada. No se pueden agregar nuevos
          productos.
        </section>
      ) : null}

      {!isClosedCampaign && products.length === 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          No hay productos activos disponibles para agregar, o todos los
          productos activos ya estan registrados en esta campania.
        </section>
      ) : null}

      {!isClosedCampaign ? (
        <form
          action={addCampaignDetailAction}
          className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
        >
          <input
            type="hidden"
            name="id_campania"
            value={campaign.id_campania}
          />

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
                  {product.nombre_producto} · {product.categoria} ·{" "}
                  {product.unidad_medida}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Cantidad objetivo *</label>

            <input
              name="cantidad_objetivo"
              type="number"
              min="0.01"
              step="0.01"
              required
              disabled={products.length === 0}
              placeholder="Ej. 100"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Observaciones</label>

            <textarea
              name="observaciones"
              rows={4}
              maxLength={500}
              disabled={products.length === 0}
              placeholder="Ej. Priorizar este producto durante la primera semana."
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            />
          </div>

          <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-800">Control de duplicados</p>
            <p className="mt-1">
              Un producto solo puede registrarse una vez dentro de la misma
              campania.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4">
            <Link
              href={`/dashboard/production/campaigns/${campaign.id_campania}`}
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={products.length === 0}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Agregar producto
            </button>
          </div>
        </form>
      ) : null}

      {isClosedCampaign ? (
        <div>
          <Link
            href={`/dashboard/production/campaigns/${campaign.id_campania}`}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Volver al detalle de campania
          </Link>
        </div>
      ) : null}
    </main>
  );
}
