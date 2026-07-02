import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { APP_ROLES } from "@/lib/permissions";
import { createMachineAction } from "@/modules/maintenance/machines/actions";
import { MachineForm } from "@/modules/maintenance/machines/machine-form";

export default async function NewMachinePage() {
  await requireRole([APP_ROLES.ADMIN]);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard - Mantenimiento de maquinaria - Nueva maquina
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Registrar maquina
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Registra una maquina o equipo critico del taller para controlar su
            estado operativo, ubicacion y codigo interno.
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
            action={createMachineAction}
            defaultValues={{
              tipo: "prensa",
              estado: "operativa",
            }}
            submitLabel="Registrar maquina"
          />
        </CardContent>
      </Card>
    </main>
  );
}
