/**
 * Ubicación destino: src/app/(dashboard)/dashboard/production/page.tsx
 * (reemplaza el archivo actual)
 *
 * Único cambio: el array `modules` gana icon/tone, y el .map() les pasa
 * icon/tone/index al <ModuleAccessCard>. Todo lo demás queda idéntico.
 */
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { ModuleAccessCard } from "@/components/ui/module-access-card";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs } from "@/lib/navigation";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  Circle,
  ClipboardList,
  Factory,
  FlaskConical,
  Gauge,
  Layers,
  Route,
  Tag,
} from "lucide-react";

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
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

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
    totalCampaigns,
    activeCampaigns,
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

    prisma.campania_produccion.count(),

    prisma.campania_produccion.count({
      where: {
        estado: {
          in: ["planificada", "activa"],
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

  const checklist = [
    { label: "Productos activos", ok: activeProducts > 0, hint: "Necesarios para crear rutas, recetas y órdenes." },
    { label: "Rutas de fabricación", ok: activeRoutes > 0, hint: "Definen el flujo productivo de cada producto." },
    { label: "Etapas activas", ok: activeStages > 0, hint: "Permiten generar avances de producción." },
    { label: "Recetas técnicas activas", ok: activeRecipes > 0, hint: "Permiten asociar materiales al producto." },
    { label: "Versiones vigentes", ok: validVersions > 0, hint: "Cada receta necesita una versión vigente para operar." },
    { label: "Materiales requeridos", ok: recipeDetails > 0, hint: "Necesarios para calcular requerimientos de producción." },
  ];

  const modules = [
    {
      title: "Rutas de fabricación",
      href: "/dashboard/production/routes",
      description: "Define rutas por producto y estructura el proceso productivo.",
      icon: Route,
      tone: "chart-1" as const,
    },
    {
      title: "Recetas técnicas",
      href: "/dashboard/production/recipes",
      description: "Administra recetas, versiones y materiales requeridos por producto.",
      icon: FlaskConical,
      tone: "chart-2" as const,
    },
    {
      title: "Órdenes de trabajo",
      href: "/dashboard/production/work-orders",
      description: "Crea órdenes, revisa materiales y controla avances por etapa.",
      icon: ClipboardList,
      tone: "chart-3" as const,
    },
    {
      title: "Campañas",
      href: "/dashboard/production/campaigns",
      description: "Planifica lotes de producción y vincúlalos con órdenes de trabajo.",
      icon: Layers,
      tone: "chart-4" as const,
    },
    {
      title: "Cuellos de botella",
      href: "/dashboard/production/bottlenecks",
      description: "Detecta etapas en proceso atrasadas, en riesgo o saturadas.",
      icon: Gauge,
      tone: "chart-5" as const,
    },
  ];

  return (
    <main className="space-y-6">
      <PageHeader
        title="Producción"
        description="Gestiona rutas de fabricación, etapas, recetas técnicas, versiones, materiales requeridos, órdenes de trabajo y avances de producción."
        breadcrumbs={dashboardBreadcrumbs([{ label: "Producción" }])}
        actions={
          <Button asChild>
            <Link href="/dashboard/production/work-orders/new">
              Nueva orden
            </Link>
          </Button>
        }
      />

      <Alert variant={isModuleReady ? "success" : "warning"}>
        <AlertDescription>
          <span className="font-medium text-foreground">
            {isModuleReady ? "Producción lista" : "Producción incompleta"}
          </span>
          <span className="block mt-1">{moduleHealthMessage}</span>
        </AlertDescription>
      </Alert>

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Órdenes registradas" value={totalOrders.toString()} description="Total histórico." tone="info" icon={ClipboardList} />
        <KpiCard title="Órdenes activas" value={activeOrders.toString()} description="Pendientes, en proceso o pausadas." tone="warning" icon={Activity} />
        <KpiCard title="En proceso" value={inProcessOrders.toString()} description="Con avance operativo actual." tone="info" icon={Factory} />
        <KpiCard title="Finalizadas" value={finishedOrders.toString()} description="Órdenes completadas." tone="success" icon={CheckCircle2} />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Productos activos" value={activeProducts.toString()} description="Disponibles para producción." tone="info" icon={Tag} />
        <KpiCard title="Rutas activas" value={activeRoutes.toString()} description="Rutas de fabricación habilitadas." tone="info" icon={Route} />
        <KpiCard title="Etapas activas" value={activeStages.toString()} description="Etapas dentro de rutas activas." tone="info" icon={Layers} />
        <KpiCard title="Materiales en recetas" value={recipeDetails.toString()} description="Registrados en versión vigente." tone="info" icon={FlaskConical} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((module, i) => (
          <ModuleAccessCard
            key={module.href}
            index={i + 1}
            tone={module.tone}
            icon={module.icon}
            title={module.title}
            description={module.description}
            href={module.href}
          />
        ))}
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-6">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Checklist operativo
        </h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {checklist.map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-3 rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm"
            >
              {item.ok ? (
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-chart-3"
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <div>
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="mt-1 text-muted-foreground">{item.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-5">
        <p className="font-medium text-foreground">Estados actuales</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">Pendientes: {pendingOrders}</Badge>
          <Badge variant="info">En proceso: {inProcessOrders}</Badge>
          <Badge variant="warning">Pausadas: {pausedOrders}</Badge>
          <Badge variant="success">Finalizadas: {finishedOrders}</Badge>
          <Badge variant="secondary">
            Campañas activas/planificadas: {activeCampaigns}
          </Badge>
          <Badge variant="secondary">
            Campañas registradas: {totalCampaigns}
          </Badge>
        </div>
      </section>
    </main>
  );
}
