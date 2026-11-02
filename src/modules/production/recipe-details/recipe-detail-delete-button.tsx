import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RecipeDetailDeleteState } from "@/modules/production/recipe-details/actions";

type RecipeDetailDeleteButtonProps = {
  detail: {
    id_detalle_receta: string;
    material: { nombre_material: string };
  };
  action: (prevState: RecipeDetailDeleteState, formData: FormData) => Promise<RecipeDetailDeleteState>;
  /** Aviso al eliminar; la pagina lo pasa con su clave literal. */
  deletedNotification: NotificationDefinition;
};

// Eliminar una linea de receta desde su fila (entrega 10.6b). El borrado es fisico,
// asi que confirma con el material; la fila solo muestra el boton mientras ninguna
// orden use la version, y la accion lo vuelve a comprobar con la receta bloqueada.
export function RecipeDetailDeleteButton({ detail, action, deletedNotification }: RecipeDetailDeleteButtonProps) {
  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_detalle_receta: detail.id_detalle_receta }}
      variant="destructive"
      size="sm"
      successNotification={deletedNotification}
      confirm={{
        title: "¿Eliminar material de la receta?",
        description: `Se quitará ${detail.material.nombre_material} de esta versión. Para recuperarlo tendrás que volver a agregarlo.`,
        confirmText: "Eliminar",
      }}
      pendingText="Eliminando..."
    >
      Eliminar
    </ConfirmActionButton>
  );
}
