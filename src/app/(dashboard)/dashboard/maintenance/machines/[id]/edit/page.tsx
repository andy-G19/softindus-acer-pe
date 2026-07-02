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
import { updateMachineAction } from "@/modules/maintenance/machines/actions";
import { MachineForm } from "@/modules/maintenance/machines/machine-form";

type EditMachinePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditMachinePage({
  params,
}: EditMachinePageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const machine = await prisma.maquina.findUnique({
    where: {
      id_maquina: id,
    },
  });

  if (!machine) {
    notFound();
  }

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard - Mantenimiento de maquinaria - Editar maquina
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Editar maquina
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Actualiza datos maestros de la maquina sin modificar fallas,
            reparaciones ni mantenimientos preventivos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge>Solo ADMIN</Badge>
          <Link
            href="/dashboard/maintenance/machines"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al listado
          </Link>
        </div>
      </section>

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
