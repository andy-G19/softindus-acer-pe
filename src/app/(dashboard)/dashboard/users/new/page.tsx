import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/authz";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createUserAction } from "@/modules/users/actions";
import { usersNotifications } from "@/modules/users/notifications";
import { UserForm } from "@/modules/users/user-form";
import { newUserFormValues } from "@/modules/users/user-form-values";

type NewUserPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewUserPage({ searchParams }: NewUserPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.users);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nuevo usuario"
        description="Registra una cuenta de acceso al sistema con su rol correspondiente."
        backHref={backHref}
        backLabel="Volver a usuarios"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Usuarios", href: backHref },
          { label: "Nuevo usuario" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <UserForm
        action={createUserAction}
        defaultValues={newUserFormValues()}
        submitLabel="Registrar usuario"
        successNotification={usersNotifications["user-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
