import { UserRoundCheck, UserX, Users } from "lucide-react";
import Link from "next/link";

import { ConfirmDeleteButton } from "@/components/notifications/confirm-delete-button";
import { PageHeader } from "@/components/navigation/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import { RowEditLink } from "@/components/table/row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/formatters";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { getPaginationMeta, getPaginationParams } from "@/lib/pagination";
import {
  APP_ROLES,
  getRoleLabel,
  getUserStatusLabel,
} from "@/lib/permissions";
import { parseStringParam, type SearchParamsRecord } from "@/lib/search-params";
import {
  activateUserAction,
  deactivateUserAction,
} from "@/modules/users/actions";

const ROLE_OPTIONS = [
  APP_ROLES.ADMIN,
  APP_ROLES.SELLER,
  APP_ROLES.WORKSHOP_MASTER,
];

type UsersPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const session = await requireRole([APP_ROLES.ADMIN]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const rol = parseStringParam(params, "rol");
  const estado = parseStringParam(params, "estado");
  const { page, pageSize, skip, take } = getPaginationParams(params);

  const filters: Prisma.usuarioWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { nombres: { contains: q, mode: "insensitive" } },
        { apellidos: { contains: q, mode: "insensitive" } },
        { usuario: { contains: q, mode: "insensitive" } },
        { correo: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (rol) {
    filters.push({ rol: { nombre_rol: rol } });
  }

  if (estado === "activo" || estado === "inactivo") {
    filters.push({ estado });
  }

  const where: Prisma.usuarioWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [users, totalItems, totalUsers, totalActive, totalInactive] =
    await Promise.all([
      prisma.usuario.findMany({
        where,
        orderBy: [{ fecha_registro: "desc" }, { id_usuario: "desc" }],
        skip,
        take,
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
      }),
      prisma.usuario.count({ where }),
      prisma.usuario.count(),
      prisma.usuario.count({ where: { estado: "activo" } }),
      prisma.usuario.count({ where: { estado: "inactivo" } }),
    ]);

  const meta = getPaginationMeta({ totalItems, page, pageSize });

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
          value={totalUsers.toString()}
          description="Total de cuentas en el sistema."
          tone="info"
          icon={Users}
        />
        <KpiCard
          title="Activos"
          value={totalActive.toString()}
          description="Pueden iniciar sesión."
          tone="success"
          icon={UserRoundCheck}
        />
        <KpiCard
          title="Inactivos"
          value={totalInactive.toString()}
          description="Sin acceso al sistema."
          tone="warning"
          icon={UserX}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros de búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={navigationHrefs.users}
            className="grid gap-3 md:grid-cols-4"
          >
            <div className="space-y-2">
              <Label htmlFor="q">Buscar</Label>
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Nombre, usuario o correo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rol">Rol</Label>
              <NativeSelect id="rol" name="rol" defaultValue={rol}>
                <option value="">Todos los roles</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {getRoleLabel(role)}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <NativeSelect id="estado" name="estado" defaultValue={estado}>
                <option value="">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </NativeSelect>
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit" className="flex-1">
                Filtrar
              </Button>
              <Button variant="clear" asChild>
                <Link href={navigationHrefs.users}>Limpiar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuarios registrados</CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {users.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No se encontraron usuarios con los filtros aplicados."
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
                      <TableCell>
                        {user.ultimo_acceso
                          ? formatDateTime(user.ultimo_acceso)
                          : "Sin registro"}
                      </TableCell>
                      <TableCell>{formatDateTime(user.fecha_registro)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <RowEditLink
                            href={`${navigationHrefs.users}/${user.id_usuario}/edit`}
                          />

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

          <div className="px-6">
            <PaginationControls
              meta={meta}
              basePath={navigationHrefs.users}
              searchParams={params}
              itemLabel="usuarios"
            />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
