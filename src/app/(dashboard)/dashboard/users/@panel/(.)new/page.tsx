import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createUserAction } from "@/modules/users/actions";
import { usersNotifications } from "@/modules/users/notifications";
import { UserForm } from "@/modules/users/user-form";
import { newUserFormValues } from "@/modules/users/user-form-values";

type NewUserPanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de usuario en panel lateral (entrega 10.7b), interceptada desde el listado.
// Mismo formulario, accion y permisos que new/page.tsx.
export default async function NewUserPanel({ searchParams }: NewUserPanelProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.users);

  return (
    <RouteSheet
      title="Nuevo usuario"
      description="Registra una cuenta de acceso al sistema con su rol correspondiente."
      discardTitle="¿Descartar el usuario nuevo?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <UserForm
        action={createUserAction}
        defaultValues={newUserFormValues()}
        submitLabel="Registrar usuario"
        successNotification={usersNotifications["user-created"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
