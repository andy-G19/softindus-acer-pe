import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { WorkOrderForm } from "@/modules/production/work-orders/components/work-order-form";

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function toDecimalString(value: unknown) {
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
        include: {
          campania_detalle: {
            select: {
              id_producto: true,
            },
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

  const formProducts = products.map((product) => ({
    id_producto: product.id_producto,
    nombre_producto: product.nombre_producto,
    categoria: product.categoria,
    unidad_medida: product.unidad_medida,
  }));

  const formRoutes = routes.map((route) => ({
    id_ruta: route.id_ruta,
    id_producto: route.id_producto,
    nombre_ruta: route.nombre_ruta,
    producto_nombre: route.producto.nombre_producto,
    etapas_activas: route._count.etapa_ruta,
  }));

  const formVersions = versions.map((version) => ({
    id_version_receta: version.id_version_receta,
    id_producto: version.receta_tecnica.id_producto,
    nombre_receta: version.receta_tecnica.nombre_receta,
    producto_nombre: version.receta_tecnica.producto.nombre_producto,
    numero_version: version.numero_version,
    materiales: version._count.detalle_receta,
  }));

  const formOrderDetails = orderDetails.map((detail) => ({
    id_detalle_pedido: detail.id_detalle_pedido,
    id_producto: detail.id_producto,
    id_pedido: detail.id_pedido,
    producto_nombre: detail.producto.nombre_producto,
    cliente_nombre: detail.pedido.cliente.nombre_razon_social,
    cantidad: toDecimalString(detail.cantidad),
  }));

  const formCampaigns = campaigns.map((campaign) => ({
    id_campania: campaign.id_campania,
    nombre_campania: campaign.nombre_campania,
    estado: campaign.estado,
    productIds: Array.from(
      new Set(campaign.campania_detalle.map((detail) => detail.id_producto)),
    ),
  }));

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">
          Produccion - Ordenes de trabajo
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Nueva orden de trabajo
        </h1>

        <p className="mt-2 text-slate-600">
          Crea una orden de produccion asociando producto, ruta de fabricacion,
          version de receta y cantidad a fabricar.
        </p>
      </section>

      {!canCreateOrder ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Para crear una orden necesitas tener productos activos, rutas de
          fabricacion activas y versiones de receta vigentes con materiales
          registrados.
        </section>
      ) : null}

      <WorkOrderForm
        products={formProducts}
        routes={formRoutes}
        versions={formVersions}
        orderDetails={formOrderDetails}
        campaigns={formCampaigns}
        canCreateOrder={canCreateOrder}
        initialStartDate={getTodayInputValue()}
      />
    </main>
  );
}
