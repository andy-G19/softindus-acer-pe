import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/navigation/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { updateMachineAction } from "@/modules/maintenance/machines/actions";
import { MachineForm } from "@/modules/maintenance/machines/machine-form";

type EditMachinePageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditMachinePage({
  params,
  searchParams,
}: EditMachinePageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  const machine = await prisma.maquina.findUnique({
    where: {
      id_maquina: id,
    },
  });

  if (!machine) {
    notFound();
  }

  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.machines);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Editar máquina"
        description="Actualiza datos maestros de la máquina sin modificar fallas, reparaciones ni mantenimientos preventivos."
        backHref={backHref}
        backLabel="Volver a máquinas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Máquinas", href: backHref },
          { label: "Editar máquina" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos principales</CardTitle>
        </CardHeader>
        <CardContent>
          <MachineForm
            action={updateMachineAction}
            defaultValues={{
              id_maquina: machine.id_maquina,
              nombre: machine.nombre,
              tipo: machine.tipo,
              codigo_interno: machine.codigo_interno ?? "",
              ubicacion: machine.ubicacion ?? "",
              estado: machine.estado,
              observaciones: machine.observaciones ?? "",
            }}
            submitLabel="Guardar cambios"
          />
        </CardContent>
      </Card>
    </main>
  );
}
