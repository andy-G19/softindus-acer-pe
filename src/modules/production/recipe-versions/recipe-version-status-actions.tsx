import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type RecipeVersionAction = (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;

type RecipeVersionStatusActionsProps = {
  recipe: {
    id_receta: string;
    estado: string;
  };
  version: {
    id_version_receta: string;
    numero_version: string;
    estado: string;
    _count: { orden_trabajo: number };
  };
  /** Numero de la version vigente de la receta, si tiene una. */
  currentVersionNumber?: string;
  setCurrentAction: RecipeVersionAction;
  voidAction: RecipeVersionAction;
  /** Avisos al terminar; la pagina los pasa con su clave literal. */
  setCurrentNotification: NotificationDefinition;
  annulledNotification: NotificationDefinition;
};

const CANNOT_UNDO = "La anulación no se puede deshacer.";

// Marcar vigente y anular una version desde su fila (entrega 10.6b). Cada boton solo
// aparece cuando la accion puede aceptarlo y la accion lo vuelve a comprobar con la
// receta bloqueada. Marcar vigente no borra nada: confirma con el boton normal.
export function RecipeVersionStatusActions({
  recipe,
  version,
  currentVersionNumber,
  setCurrentAction,
  voidAction,
  setCurrentNotification,
  annulledNotification,
}: RecipeVersionStatusActionsProps) {
  const fields = { id_receta: recipe.id_receta, id_version_receta: version.id_version_receta };
  const canSetCurrent = recipe.estado === "activa" && version.estado !== "vigente" && version.estado !== "anulada";
  const canVoid = version.estado !== "anulada" && version._count.orden_trabajo === 0;

  return (
    <>
      {canSetCurrent ? (
        <ConfirmActionButton
          action={setCurrentAction}
          fields={fields}
          successNotification={setCurrentNotification}
          confirm={{
            title: `¿Marcar la versión ${version.numero_version} como vigente?`,
            description: currentVersionNumber
              ? `Las nuevas órdenes de trabajo usarán esta versión y la ${currentVersionNumber} quedará reemplazada.`
              : "Las nuevas órdenes de trabajo usarán esta versión.",
            confirmText: "Marcar vigente",
            variant: "default",
          }}
          pendingText="Marcando..."
        >
          Marcar vigente
        </ConfirmActionButton>
      ) : null}

      {canVoid ? (
        <ConfirmActionButton
          action={voidAction}
          fields={fields}
          variant="destructive"
          successNotification={annulledNotification}
          confirm={{
            title: `¿Anular la versión ${version.numero_version}?`,
            description:
              version.estado === "vigente"
                ? `La versión no anulada más reciente pasará a ser la vigente. ${CANNOT_UNDO}`
                : `Ya no se podrá marcar como vigente. ${CANNOT_UNDO}`,
            confirmText: "Anular",
          }}
          pendingText="Anulando..."
        >
          Anular
        </ConfirmActionButton>
      ) : null}
    </>
  );
}
