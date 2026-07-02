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
import { createOperatorAction } from "@/modules/staff/operators/actions";
import { OperatorForm } from "@/modules/staff/operators/operator-form";

export default async function NewOperatorPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const today = new Date().toISOString().split("T")[0];

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard - Personal, asistencia y pagos - Nuevo operario
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Registrar operario
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Registra los datos laborales basicos del trabajador, modalidad de
            pago, tarifa y estado dentro del taller.
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
            action={createOperatorAction}
            defaultValues={{
              fecha_ingreso: today,
              modalidad_pago: "semanal",
              estado: "activo",
            }}
            submitLabel="Registrar operario"
          />
        </CardContent>
      </Card>
    </main>
  );
}
