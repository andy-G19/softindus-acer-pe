import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { updateUserAction } from "@/modules/users/actions";
import { UserForm } from "@/modules/users/user-form";

type EditUserPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditUserPage({ params }: EditUserPageProps) {
  const session = await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const user = await prisma.usuario.findUnique({
    where: { id_usuario: id },
    select: {
      id_usuario: true,
      nombres: true,
      apellidos: true,
      usuario: true,
      correo: true,
      estado: true,
      rol: { select: { nombre_rol: true } },
    },
  });

  if (!user) {
    notFound();
  }

  const isSelf = user.id_usuario === session.user.id;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Editar usuario"
        description="Actualiza los datos, el rol o el estado de la cuenta."
        backHref={navigationHrefs.users}
        backLabel="Volver a usuarios"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Usuarios", href: navigationHrefs.users },
          { label: "Editar usuario" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <UserForm
            mode="edit"
            action={updateUserAction}
            isSelf={isSelf}
            defaultValues={{
              id_usuario: user.id_usuario,
              nombres: user.nombres,
              apellidos: user.apellidos,
              usuario: user.usuario,
              correo: user.correo ?? "",
              rol: user.rol.nombre_rol,
              estado: user.estado,
            }}
            submitLabel="Guardar cambios"
          />
        </CardContent>
      </Card>
    </main>
  );
}
