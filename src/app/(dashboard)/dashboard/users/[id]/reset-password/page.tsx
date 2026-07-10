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
import { ResetPasswordForm } from "@/modules/users/reset-password-form";

type ResetPasswordPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ResetUserPasswordPage({
  params,
}: ResetPasswordPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const user = await prisma.usuario.findUnique({
    where: { id_usuario: id },
    select: {
      id_usuario: true,
      nombres: true,
      apellidos: true,
      correo: true,
    },
  });

  if (!user) {
    notFound();
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Reiniciar contraseña"
        description={`Define una nueva contraseña para ${user.nombres} ${user.apellidos} (${user.correo ?? user.id_usuario}). La contraseña anterior dejará de funcionar de inmediato.`}
        backHref={navigationHrefs.users}
        backLabel="Volver a usuarios"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Usuarios", href: navigationHrefs.users },
          { label: "Reiniciar contraseña" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nueva contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm idUsuario={user.id_usuario} />
        </CardContent>
      </Card>
    </main>
  );
}
