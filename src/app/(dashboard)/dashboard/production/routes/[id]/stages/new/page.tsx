import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { createRouteStageAction } from "@/modules/production/stages/actions";
import { StageForm } from "@/modules/production/stages/stage-form";

type NewRouteStagePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function NewRouteStagePage({
  params,
}: NewRouteStagePageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id } = await params;

  const [route, machines] = await Promise.all([
    prisma.ruta_fabricacion.findUnique({
      where: {
        id_ruta: id,
      },
      include: {
        producto: true,
        etapa_ruta: {
          orderBy: {
            orden_secuencia: "desc",
          },
          take: 1,
        },
      },
    }),

    // Solo máquinas asignables: una dada de baja o inactiva no debe ofrecerse.
    prisma.maquina.findMany({
      where: {
        estado: {
          notIn: ["dada_de_baja", "inactiva"],
        },
      },
      orderBy: {
        nombre: "asc",
      },
      select: {
        id_maquina: true,
        nombre: true,
        tipo: true,
        estado: true,
      },
    }),
  ]);

  if (!route) {
    notFound();
  }

  const suggestedOrder = (route.etapa_ruta[0]?.orden_secuencia ?? 0) + 1;

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nueva etapa de ruta"
        description={`Ruta: ${route.nombre_ruta} · Producto: ${route.producto.nombre_producto}`}
        backHref={`/dashboard/production/routes/${route.id_ruta}/stages`}
        backLabel="Volver a etapas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Rutas", href: navigationHrefs.routes },
          { label: "Etapas", href: `/dashboard/production/routes/${route.id_ruta}/stages` },
          { label: "Nueva etapa" },
        ])}
      />

      {!route.estado ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta ruta está inactiva. Actívala antes de agregar nuevas etapas.
          </AlertDescription>
        </Alert>
      ) : null}

      <Alert variant="info">
        <AlertDescription>
          Usa números consecutivos en el orden de ejecución: 1, 2, 3, 4... Esto
          permite calcular el flujo de producción y mostrar los avances
          ordenados.
        </AlertDescription>
      </Alert>

      <StageForm
        action={createRouteStageAction}
        routeId={route.id_ruta}
        machines={machines}
        defaultValues={{
          orden_secuencia: String(suggestedOrder),
        }}
        submitLabel="Registrar etapa"
        disabled={!route.estado}
      />
    </main>
  );
}
