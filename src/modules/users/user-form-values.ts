import { APP_ROLES } from "@/lib/permissions";
import type { UserFormValues } from "@/modules/users/actions";

/** Un usuario nuevo empieza sin datos y con el rol de vendedor. */
export function newUserFormValues(): UserFormValues {
  return { nombres: "", apellidos: "", usuario: "", correo: "", rol: APP_ROLES.SELLER };
}

/** Los valores del formulario de edicion, los mismos en el panel y en la pagina. */
export function userEditFormValues(user: {
  id_usuario: string;
  nombres: string;
  apellidos: string;
  usuario: string;
  correo: string | null;
  rol: { nombre_rol: string };
}) {
  return {
    id_usuario: user.id_usuario,
    nombres: user.nombres,
    apellidos: user.apellidos,
    usuario: user.usuario,
    correo: user.correo ?? "",
    rol: user.rol.nombre_rol,
  };
}
