import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/access-denied");
  }
}

function getModuleHealthMessage(data: {
  activeProducts: number;
  activeRoutes: number;
  activeStages: number;
  activeRecipes: number;
  validVersions: number;
  recipeDetails: number;
}) {
  if (data.activeProducts === 0) {
    return "Primero registra productos activos para poder usar Producción.";
  }

  if (data.activeRoutes === 0) {
    return "Faltan rutas de fabricación activas.";
  }

  if (data.activeStages === 0) {
    return "Faltan etapas activas dentro de las rutas de fabricación.";
  }

  if (data.activeRecipes === 0) {
    return "Faltan recetas técnicas activas.";
  }

  if (data.validVersions === 0) {
    return "Faltan versiones vigentes de recetas técnicas.";
  }

  if (data.recipeDetails === 0) {
    return "Faltan materiales registrados en el detalle de receta.";
  }

  return "El módulo Producción está listo para operar órdenes de trabajo.";
}

export default async function ProductionDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const [
    totalOrders,
    activeOrders,
    pendingOrders,
    inProcessOrders,
    pausedOrders,
    finishedOrders,
    activeProducts,
    activeRoutes,
    activeStages,
    activeRecipes,
    validVersions,
    recipeDetails,
  ] = await Promise.all([
    prisma.orden_trabajo.count(),

    prisma.orden_trabajo.count({
      where: {
        estado: {
          in: ["pendiente", "en_proceso", "pausada"],
        },
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: "pendiente",
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: "en_proceso",
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: "pausada",
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: "finalizada",
      },
    }),

    prisma.producto.count({
      where: {
        estado: true,
      },
    }),

    prisma.ruta_fabricacion.count({
      where: {
        estado: true,
      },
    }),

    prisma.etapa_ruta.count({
      where: {
        estado: true,
        ruta_fabricacion: {
          estado: true,
        },
      },
    }),

    prisma.receta_tecnica.count({
      where: {
        estado: "activa",
      },
    }),

    prisma.version_receta.count({
      where: {
        estado: "vigente",
        receta_tecnica: {
          estado: "activa",
        },
      },
    }),

    prisma.detalle_receta.count({
      where: {
        version_receta: {
          estado: "vigente",
          receta_tecnica: {
            estado: "activa",
          },
        },
      },
    }),
  ]);

  const moduleHealthMessage = getModuleHealthMessage({
    activeProducts,
    activeRoutes,
    activeStages,
    activeRecipes,
    validVersions,
    recipeDetails,
  });

  const isModuleReady =
    activeProducts > 0 &&
    activeRoutes > 0 &&
    activeStages > 0 &&
    activeRecipes > 0 &&
    validVersions > 0 &&
    recipeDetails > 0;

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Producción
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Módulo Producción
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Gestiona rutas de fabricación, etapas, recetas técnicas, versiones,
            materiales requeridos, órdenes de trabajo y avances de producción.
          </p>
        </div>

        <Link
          href="/dashboard/production/work-orders/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nueva orden
        </Link>
      </section>

      <section
        className={`rounded-xl border p-5 text-sm ${
          isModuleReady
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        <p className="font-semibold">
          {isModuleReady ? "✅ Producción lista" : "⚠️ Producción incompleta"}
        </p>

        <p className="mt-1">{moduleHealthMessage}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Órdenes registradas</p>
          <p className="mt-2 text-3xl font-bold">{totalOrders}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Órdenes activas</p>
          <p className="mt-2 text-3xl font-bold">{activeOrders}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">En proceso</p>
          <p className="mt-2 text-3xl font-bold">{inProcessOrders}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Finalizadas</p>
          <p className="mt-2 text-3xl font-bold">{finishedOrders}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Productos activos</p>
          <p className="mt-2 text-3xl font-bold">{activeProducts}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Rutas activas</p>
          <p className="mt-2 text-3xl font-bold">{activeRoutes}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Etapas activas</p>
          <p className="mt-2 text-3xl font-bold">{activeStages}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Materiales en recetas</p>
          <p className="mt-2 text-3xl font-bold">{recipeDetails}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link
          href="/dashboard/production/routes"
          className="rounded-xl border bg-white p-6 shadow-sm transition hover:bg-slate-50"
        >
          <h2 className="text-xl font-semibold">Rutas de fabricación</h2>

          <p className="mt-2 text-sm text-slate-600">
            Define rutas por producto y estructura el proceso productivo.
          </p>

          <p className="mt-4 text-sm font-medium text-slate-900">
            Ver rutas →
          </p>
        </Link>

        <Link
          href="/dashboard/production/recipes"
          className="rounded-xl border bg-white p-6 shadow-sm transition hover:bg-slate-50"
        >
          <h2 className="text-xl font-semibold">Recetas técnicas</h2>

          <p className="mt-2 text-sm text-slate-600">
            Administra recetas, versiones y materiales requeridos por producto.
          </p>

          <p className="mt-4 text-sm font-medium text-slate-900">
            Ver recetas →
          </p>
        </Link>

        <Link
          href="/dashboard/production/work-orders"
          className="rounded-xl border bg-white p-6 shadow-sm transition hover:bg-slate-50"
        >
          <h2 className="text-xl font-semibold">Órdenes de trabajo</h2>

          <p className="mt-2 text-sm text-slate-600">
            Crea órdenes, revisa materiales y controla avances por etapa.
          </p>

          <p className="mt-4 text-sm font-medium text-slate-900">
            Ver órdenes →
          </p>
        </Link>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Checklist operativo</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border bg-slate-50 p-4 text-sm">
            <p className="font-medium">
              {activeProducts > 0 ? "✅" : "⬜"} Productos activos
            </p>
            <p className="mt-1 text-slate-600">
              Necesarios para crear rutas, recetas y órdenes.
            </p>
          </div>

          <div className="rounded-lg border bg-slate-50 p-4 text-sm">
            <p className="font-medium">
              {activeRoutes > 0 ? "✅" : "⬜"} Rutas de fabricación
            </p>
            <p className="mt-1 text-slate-600">
              Definen el flujo productivo de cada producto.
            </p>
          </div>

          <div className="rounded-lg border bg-slate-50 p-4 text-sm">
            <p className="font-medium">
              {activeStages > 0 ? "✅" : "⬜"} Etapas activas
            </p>
            <p className="mt-1 text-slate-600">
              Permiten generar avances de producción.
            </p>
          </div>

          <div className="rounded-lg border bg-slate-50 p-4 text-sm">
            <p className="font-medium">
              {activeRecipes > 0 ? "✅" : "⬜"} Recetas técnicas activas
            </p>
            <p className="mt-1 text-slate-600">
              Permiten asociar materiales al producto.
            </p>
          </div>

          <div className="rounded-lg border bg-slate-50 p-4 text-sm">
            <p className="font-medium">
              {validVersions > 0 ? "✅" : "⬜"} Versiones vigentes
            </p>
            <p className="mt-1 text-slate-600">
              Cada receta necesita una versión vigente para operar.
            </p>
          </div>

          <div className="rounded-lg border bg-slate-50 p-4 text-sm">
            <p className="font-medium">
              {recipeDetails > 0 ? "✅" : "⬜"} Materiales requeridos
            </p>
            <p className="mt-1 text-slate-600">
              Necesarios para calcular requerimientos de producción.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-slate-50 p-5 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Estados actuales</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            Pendientes: {pendingOrders}
          </span>

          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
            En proceso: {inProcessOrders}
          </span>

          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
            Pausadas: {pausedOrders}
          </span>

          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
            Finalizadas: {finishedOrders}
          </span>
        </div>
      </section>
    </main>
  );
}