import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
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
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard - Personal, asistencia y pagos - Editar operario
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Editar operario
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Actualiza los datos laborales basicos del operario sin tocar
            asistencia ni planillas.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge>Solo ADMIN</Badge>
          <Link
            href="/dashboard/staff/operators"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al listado
          </Link>
        </div>
      </section>

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
