import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuth } from "@/lib/authz";
import { roleLabels, userStatusLabels } from "@/lib/permissions";
import type { UserRole, UserStatus } from "@/generated/prisma/client";

export default async function DashboardPage() {
  const session = await requireAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Bienvenido al panel principal del sistema.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usuario autenticado</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <p className="text-sm">
              <span className="font-medium">Nombre:</span>{" "}
              {session.user.name}
            </p>

            <p className="text-sm">
              <span className="font-medium">Correo:</span>{" "}
              {session.user.email}
            </p>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Rol:</span>
              <Badge>{roleLabels[session.user.role as UserRole]}</Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Estado:</span>
              <Badge variant="secondary">
                {userStatusLabels[session.user.status as UserStatus]}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seguridad</CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">
              Esta pantalla solo puede visualizarse con una sesión activa.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fase actual</CardTitle>
          </CardHeader>

          <CardContent>
            <Badge variant="secondary">Fase 1 — Seguridad y Usuarios</Badge>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}