import { notFound } from "next/navigation";

import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/authz";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { updateUserAction } from "@/modules/users/actions";
import { usersNotifications } from "@/modules/users/notifications";
import { getUserForEdit } from "@/modules/users/queries";
import { UserForm } from "@/modules/users/user-form";
import { userEditFormValues } from "@/modules/users/user-form-values";

type EditUserPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditUserPage({ params, searchParams }: EditUserPageProps) {
  const session = await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  const user = await getUserForEdit(id);

  if (!user) {
    notFound();
  }

  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.users);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Editar usuario"
        description="Actualiza los datos y el rol de la cuenta. El estado se cambia desde la lista."
        backHref={backHref}
        backLabel="Volver a usuarios"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Usuarios", href: backHref },
          { label: "Editar usuario" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <UserForm
        action={updateUserAction}
        defaultValues={userEditFormValues(user)}
        submitLabel="Guardar cambios"
        successNotification={usersNotifications["user-updated"]}
        returnTo={backHref}
        isSelf={user.id_usuario === session.user.id}
      />
    </div>
  );
}
