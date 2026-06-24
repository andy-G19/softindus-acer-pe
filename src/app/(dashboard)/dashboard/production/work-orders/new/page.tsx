import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createWorkOrderAction } from "@/modules/production/work-orders/actions";

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/access-denied");
  }
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

export default async function NewWorkOrderPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const [products, routes, versions, orderDetails, campaigns] =
    await Promise.all([
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

      prisma.ruta_fabricacion.findMany({
        where: {
          estado: true,
        },
        include: {
          producto: true,
          _count: {
            select: {
              etapa_ruta: true,
            },
          },
        },
        orderBy: [
          {
            nombre_ruta: "asc",
          },
        ],
      }),

      prisma.version_receta.findMany({
        where: {
          estado: "vigente",
          receta_tecnica: {
            estado: "activa",
          },
        },
        include: {
          receta_tecnica: {
            include: {
              producto: true,
            },
          },
          _count: {
            select: {
              detalle_receta: true,
            },
          },
        },
        orderBy: [
          {
            fecha_version: "desc",
          },
        ],
      }),

      prisma.detalle_pedido.findMany({
        where: {
          pedido: {
            estado: {
              in: ["registrado", "aprobado"],
            },
          },
        },
        include: {
          producto: true,
          pedido: {
            include: {
              cliente: true,
            },
          },
        },
        orderBy: [
          {
            pedido: {
              fecha_pedido: "desc",
            },
          },
        ],
      }),

      prisma.campania_produccion.findMany({
        where: {
          estado: {
            in: ["planificada", "activa"],
          },
        },
        orderBy: [
          {
            fecha_inicio: "desc",
          },
        ],
      }),
    ]);

  const canCreateOrder =
    products.length > 0 && routes.length > 0 && versions.length > 0;

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">
          Producción · Órdenes de trabajo
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Nueva orden de trabajo
        </h1>

        <p className="mt-2 text-slate-600">
          Crea una orden de producción asociando producto, ruta de fabricación,
          versión de receta y cantidad a fabricar.
        </p>
      </section>

      {!canCreateOrder ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Para crear una orden necesitas tener productos activos, rutas de
          fabricación activas y versiones de receta vigentes con materiales
          registrados.
        </section>
      ) : null}

      <form
        action={createWorkOrderAction}
        className="space-y-6 rounded-xl border bg-white p-6 shadow-sm"
      >
        <section className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de producción *</label>

            <select
              name="tipo_produccion"
              required
              disabled={!canCreateOrder}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            >
              <option value="pedido">Por pedido</option>
              <option value="campania">Por campaña</option>
              <option value="reposicion_stock">Reposición de stock</option>
            </select>

            <p className="text-xs text-slate-500">
              Si eliges pedido o campaña, selecciona también el registro
              correspondiente.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Prioridad *</label>

            <select
              name="prioridad"
              required
              defaultValue="media"
              disabled={!canCreateOrder}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            >
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Detalle de pedido
            </label>

            <select
              name="id_detalle_pedido"
              disabled={!canCreateOrder}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            >
              <option value="">No aplica</option>

              {orderDetails.map((detail) => (
                <option
                  key={detail.id_detalle_pedido}
                  value={detail.id_detalle_pedido}
                >
                  {detail.pedido.cliente.nombre_razon_social} ·{" "}
                  {detail.producto.nombre_producto} · Cantidad:{" "}
                  {formatDecimal(detail.cantidad)}
                </option>
              ))}
            </select>

            <p className="text-xs text-slate-500">
              Obligatorio cuando el tipo de producción es por pedido.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Campaña</label>

            <select
              name="id_campania"
              disabled={!canCreateOrder}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            >
              <option value="">No aplica</option>

              {campaigns.map((campaign) => (
                <option key={campaign.id_campania} value={campaign.id_campania}>
                  {campaign.nombre_campania} · {campaign.estado}
                </option>
              ))}
            </select>

            <p className="text-xs text-slate-500">
              Obligatorio cuando el tipo de producción es por campaña.
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <label className="text-sm font-medium">Producto *</label>

          <select
            name="id_producto"
            required
            disabled={!canCreateOrder}
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

          <p className="text-xs text-slate-500">
            Asegúrate de seleccionar una ruta y receta pertenecientes al mismo
            producto.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Ruta de fabricación *
            </label>

            <select
              name="id_ruta"
              required
              disabled={!canCreateOrder}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            >
              <option value="">Seleccione una ruta</option>

              {routes.map((route) => (
                <option key={route.id_ruta} value={route.id_ruta}>
                  {route.producto.nombre_producto} · {route.nombre_ruta} ·{" "}
                  Etapas: {route._count.etapa_ruta}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Versión de receta *
            </label>

            <select
              name="id_version_receta"
              required
              disabled={!canCreateOrder}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            >
              <option value="">Seleccione una versión</option>

              {versions.map((version) => (
                <option
                  key={version.id_version_receta}
                  value={version.id_version_receta}
                >
                  {version.receta_tecnica.producto.nombre_producto} ·{" "}
                  {version.receta_tecnica.nombre_receta} ·{" "}
                  {version.numero_version} · Materiales:{" "}
                  {version._count.detalle_receta}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Cantidad *</label>

            <input
              name="cantidad"
              type="number"
              min="0.01"
              step="0.01"
              required
              disabled={!canCreateOrder}
              placeholder="Ej. 50"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha de inicio *</label>

            <input
              name="fecha_inicio"
              type="date"
              required
              defaultValue={getTodayInputValue()}
              disabled={!canCreateOrder}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Entrega estimada
            </label>

            <input
              name="fecha_entrega_estimada"
              type="date"
              disabled={!canCreateOrder}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            />
          </div>
        </section>

        <section className="space-y-2">
          <label className="text-sm font-medium">Observaciones</label>

          <textarea
            name="observaciones"
            rows={4}
            maxLength={700}
            disabled={!canCreateOrder}
            placeholder="Ej. Priorizar corte y prensado durante la mañana."
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          />
        </section>

        <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Importante</p>

          <p className="mt-1">
            Esta fase crea la orden de trabajo y la deja en estado pendiente.
            En la siguiente fase generaremos y actualizaremos los avances por
            etapa de producción.
          </p>
        </div>

        <div className="flex items-center justify-between pt-4">
          <Link
            href="/dashboard/production/work-orders"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={!canCreateOrder}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Crear orden
          </button>
        </div>
      </form>
    </main>
  );
}