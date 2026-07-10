import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createUserAction } from "@/modules/users/actions";
import { UserForm } from "@/modules/users/user-form";

export default async function NewUserPage() {
  await requireRole([APP_ROLES.ADMIN]);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Nuevo usuario"
        description="Registra una cuenta de acceso al sistema con su rol correspondiente."
        backHref={navigationHrefs.users}
        backLabel="Volver a usuarios"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Usuarios", href: navigationHrefs.users },
          { label: "Nuevo usuario" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <UserForm
            mode="create"
            action={createUserAction}
            submitLabel="Registrar usuario"
          />
        </CardContent>
      </Card>
    </main>
  );
}
