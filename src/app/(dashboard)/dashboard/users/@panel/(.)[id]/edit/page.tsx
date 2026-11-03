import { notFound } from "next/navigation";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { updateUserAction } from "@/modules/users/actions";
import { usersNotifications } from "@/modules/users/notifications";
import { getUserForEdit } from "@/modules/users/queries";
import { UserForm } from "@/modules/users/user-form";
import { userEditFormValues } from "@/modules/users/user-form-values";

type EditUserPanelProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Edicion de usuario en panel lateral (entrega 10.7b), interceptada desde el
// listado. Misma consulta, formulario, accion y permisos que [id]/edit/page.tsx.
export default async function EditUserPanel({ params, searchParams }: EditUserPanelProps) {
  const session = await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  const user = await getUserForEdit(id);

  if (!user) {
    notFound();
  }

  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.users);

  return (
    <RouteSheet
      title="Editar usuario"
      description={`${user.nombres} ${user.apellidos} · ${user.id_usuario}`}
      discardTitle="¿Descartar los cambios del usuario?"
      discardDescription="Se perderán los cambios que hiciste en este panel."
    >
      <UserForm
        action={updateUserAction}
        defaultValues={userEditFormValues(user)}
        submitLabel="Guardar cambios"
        successNotification={usersNotifications["user-updated"]}
        returnTo={returnTo}
        isSelf={user.id_usuario === session.user.id}
      />
    </RouteSheet>
  );
}
