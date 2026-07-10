import Link from "next/link";

import { ConfirmDeleteButton } from "@/components/notifications/confirm-delete-button";
import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import {
  APP_ROLES,
  getRoleLabel,
  getUserStatusLabel,
} from "@/lib/permissions";
import {
  activateUserAction,
  deactivateUserAction,
} from "@/modules/users/actions";

function formatDate(value: Date | null) {
  if (!value) {
    return "Sin registro";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function UsersPage() {
  const session = await requireRole([APP_ROLES.ADMIN]);

  const users = await prisma.usuario.findMany({
    orderBy: {
      fecha_registro: "desc",
    },
    select: {
      id_usuario: true,
      nombres: true,
      apellidos: true,
      usuario: true,
      correo: true,
      estado: true,
      ultimo_acceso: true,
      fecha_registro: true,
      rol: {
        select: {
          nombre_rol: true,
        },
      },
    },
  });

  const activeUsers = users.filter((user) => user.estado === "activo");
  const inactiveUsers = users.filter((user) => user.estado === "inactivo");

  return (
    <main className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Administra las cuentas de acceso al sistema: roles, estado y credenciales."
        breadcrumbs={dashboardBreadcrumbs([{ label: "Usuarios" }])}
        actions={
          <Button asChild>
            <Link href={`${navigationHrefs.users}/new`}>Nuevo usuario</Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard
          title="Usuarios registrados"
          value={users.length.toString()}
          description="Total de cuentas en el sistema."
          tone="info"
        />
        <KpiCard
          title="Activos"
          value={activeUsers.length.toString()}
          description="Pueden iniciar sesión."
          tone="success"
        />
        <KpiCard
          title="Inactivos"
          value={inactiveUsers.length.toString()}
          description="Sin acceso al sistema."
          tone="warning"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuarios registrados</CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {users.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="Todavía no hay usuarios registrados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Último acceso</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {users.map((user) => {
                  const isSelf = user.id_usuario === session.user.id;

                  return (
                    <TableRow key={user.id_usuario} className="align-top">
                      <TableCell className="font-mono text-xs">
                        {user.id_usuario}
                      </TableCell>
                      <TableCell className="font-medium">
                        {user.nombres} {user.apellidos}
                        {isSelf ? (
                          <p className="text-xs font-normal text-muted-foreground">
                            (tú)
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>{user.usuario}</TableCell>
                      <TableCell>{user.correo}</TableCell>
                      <TableCell>
                        <Badge>{getRoleLabel(user.rol.nombre_rol)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.estado === "activo" ? "success" : "secondary"
                          }
                        >
                          {getUserStatusLabel(user.estado)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(user.ultimo_acceso)}</TableCell>
                      <TableCell>{formatDate(user.fecha_registro)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link
                              href={`${navigationHrefs.users}/${user.id_usuario}/edit`}
                            >
                              Editar
                            </Link>
                          </Button>

                          <Button variant="outline" size="sm" asChild>
                            <Link
                              href={`${navigationHrefs.users}/${user.id_usuario}/reset-password`}
                            >
                              Resetear contraseña
                            </Link>
                          </Button>

                          {user.estado === "activo" ? (
                            <form action={deactivateUserAction}>
                              <input
                                type="hidden"
                                name="id_usuario"
                                value={user.id_usuario}
                              />
                              <ConfirmDeleteButton
                                disabled={isSelf}
                                title="¿Desactivar usuario?"
                                description={`El usuario ${user.nombres} ${user.apellidos} no podrá iniciar sesión hasta que se reactive.`}
                                confirmText="Desactivar"
                              >
                                Desactivar
                              </ConfirmDeleteButton>
                            </form>
                          ) : (
                            <form action={activateUserAction}>
                              <input
                                type="hidden"
                                name="id_usuario"
                                value={user.id_usuario}
                              />
                              <Button type="submit" variant="outline" size="sm">
                                Activar
                              </Button>
                            </form>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
