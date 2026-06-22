import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import {
  APP_ROLES,
  getRoleLabel,
  getUserStatusLabel,
} from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  await requireRole([APP_ROLES.ADMIN]);

  const users = await prisma.usuario.findMany({
    orderBy: {
      fecha_registro: "desc",
    },
    select: {
      id_usuario: true,
      nombres: true,
      apellidos: true,
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Usuarios</h2>
        <p className="text-sm text-muted-foreground">
          Gestión inicial de usuarios del sistema conectada al DDL oficial.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios registrados</CardTitle>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead>Creado</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id_usuario}>
                  <TableCell className="font-medium">
                    {user.nombres} {user.apellidos}
                  </TableCell>
                  <TableCell>{user.correo}</TableCell>
                  <TableCell>
                    <Badge>{getRoleLabel(user.rol.nombre_rol)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {getUserStatusLabel(user.estado)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(user.ultimo_acceso)}</TableCell>
                  <TableCell>{formatDate(user.fecha_registro)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}