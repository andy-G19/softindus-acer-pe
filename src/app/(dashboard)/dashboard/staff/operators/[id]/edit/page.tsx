import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { updateOperatorAction } from "@/modules/staff/operators/actions";
import { OperatorForm } from "@/modules/staff/operators/operator-form";

type EditOperatorPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDateInput(value: Date | null) {
  if (!value) {
    return "";
  }

  return value.toISOString().split("T")[0];
}

export default async function EditOperatorPage({
  params,
}: EditOperatorPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const operator = await prisma.operario.findUnique({
    where: {
      id_operario: id,
    },
  });

  if (!operator) {
    notFound();
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Editar operario"
        description="Actualiza los datos laborales básicos del operario sin tocar asistencia ni planillas."
        backHref={navigationHrefs.operators}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Personal", href: navigationHrefs.staff },
          { label: "Operarios", href: navigationHrefs.operators },
          { label: "Editar operario" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos laborales</CardTitle>
        </CardHeader>
        <CardContent>
          <OperatorForm
            action={updateOperatorAction}
            defaultValues={{
              id_operario: operator.id_operario,
              nombres: operator.nombres,
              apellidos: operator.apellidos,
              cargo: operator.cargo ?? "",
              especialidad: operator.especialidad ?? "",
              telefono: operator.telefono ?? "",
              direccion: operator.direccion ?? "",
              modalidad_pago: operator.modalidad_pago,
              tarifa: operator.tarifa?.toString() ?? "",
              fecha_ingreso: formatDateInput(operator.fecha_ingreso),
              estado: operator.estado,
              observaciones: operator.observaciones ?? "",
            }}
            submitLabel="Guardar cambios"
          />
        </CardContent>
      </Card>
    </main>
  );
}
