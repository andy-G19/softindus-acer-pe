import { UserRoundCheck, UserX, Users } from "lucide-react";
import Link from "next/link";

import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
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
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/authz";
import { formatDateTime } from "@/lib/formatters";
import {
  createReturnToHref,
  dashboardBreadcrumbs,
  navigationHrefs,
  withReturnTo,
} from "@/lib/navigation";
import { getPaginationMeta, getPaginationParams } from "@/lib/pagination";
import {
  APP_ROLES,
  getRoleLabel,
  getUserStatusLabel,
} from "@/lib/permissions";
import { parseStringParam, type SearchParamsRecord } from "@/lib/search-params";
import {
  resetUserPasswordAction,
  updateUserStatusAction,
} from "@/modules/users/actions";
import { usersNotifications } from "@/modules/users/notifications";
import { getUserListData } from "@/modules/users/queries";
import { ResetPasswordDialog } from "@/modules/users/reset-password-dialog";
import { UserStatusActions } from "@/modules/users/user-status-actions";

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

  const { users, totalItems, totalUsers, totalActive, totalInactive } =
    await getUserListData({ q, rol, estado }, { skip, take });

  const meta = getPaginationMeta({ totalItems, page, pageSize });
  // El panel de alta o edicion vuelve a la lista con sus filtros y su pagina.
  const returnTo = createReturnToHref(navigationHrefs.users, params);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Administra las cuentas de acceso al sistema: roles, estado y credenciales."
        breadcrumbs={dashboardBreadcrumbs([{ label: "Usuarios" }])}
        actions={
          <Button asChild>
            <Link href={withReturnTo(`${navigationHrefs.users}/new`, returnTo)}>Nuevo usuario</Link>
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

      <FilterBar action={navigationHrefs.users} label="Filtros de usuarios" clearHref={navigationHrefs.users}>
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Nombre, usuario o correo" />}
        </Field>

        <Field id="rol" label="Rol">
          {(control) => (
            <NativeSelect {...control} name="rol" defaultValue={rol}>
              <option value="">Todos los roles</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {getRoleLabel(role)}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field id="estado" label="Estado">
          {(control) => (
            <NativeSelect {...control} name="estado" defaultValue={estado}>
              <option value="">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </NativeSelect>
          )}
        </Field>
      </FilterBar>

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
                            href={withReturnTo(`${navigationHrefs.users}/${user.id_usuario}/edit`, returnTo)}
                          />

                          <ResetPasswordDialog
                            action={resetUserPasswordAction}
                            idUsuario={user.id_usuario}
                            nombre={`${user.nombres} ${user.apellidos}`}
                            correo={user.correo ?? user.id_usuario}
                            successNotification={usersNotifications["user-password-reset"]}
                          />

                          <UserStatusActions
                            user={{
                              id_usuario: user.id_usuario,
                              nombre: `${user.nombres} ${user.apellidos}`,
                              estado: user.estado,
                            }}
                            isSelf={isSelf}
                            action={updateUserStatusAction}
                            activatedNotification={usersNotifications["user-activated"]}
                            deactivatedNotification={usersNotifications["user-deactivated"]}
                          />
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
    </div>
  );
}
