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
import { updateSparePartAction } from "@/modules/maintenance/spare-parts/actions";
import { SparePartForm } from "@/modules/maintenance/spare-parts/spare-part-form";

type EditSparePartPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditSparePartPage({
  params,
}: EditSparePartPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const sparePart = await prisma.repuesto.findUnique({
    where: {
      id_repuesto: id,
    },
  });

  if (!sparePart) {
    notFound();
  }

  const providers = await prisma.proveedor.findMany({
    where: {
      OR: [
        {
          estado: true,
        },
        ...(sparePart.id_proveedor
          ? [
              {
                id_proveedor: sparePart.id_proveedor,
              },
            ]
          : []),
      ],
    },
    orderBy: {
      razon_social: "asc",
    },
    select: {
      id_proveedor: true,
      razon_social: true,
    },
  });

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard - Mantenimiento de maquinaria - Editar repuesto
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Editar repuesto
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Actualiza datos maestros del repuesto sin tocar reparaciones.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge>Solo ADMIN</Badge>
          <Link
            href="/dashboard/maintenance/spare-parts"
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
          <SparePartForm
            action={updateSparePartAction}
            providers={providers.map((provider) => ({
              id: provider.id_proveedor,
              label: provider.razon_social,
            }))}
            defaultValues={{
              id_repuesto: sparePart.id_repuesto,
              id_proveedor: sparePart.id_proveedor ?? "",
              nombre_repuesto: sparePart.nombre_repuesto,
              descripcion: sparePart.descripcion ?? "",
              costo_unitario: sparePart.costo_unitario.toString(),
              estado: String(sparePart.estado),
            }}
            submitLabel="Guardar cambios"
          />
        </CardContent>
      </Card>
    </main>
  );
}
