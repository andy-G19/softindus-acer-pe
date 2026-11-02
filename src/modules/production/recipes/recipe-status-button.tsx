import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { StatusToggleState } from "@/lib/requested-status";

type RecipeStatusButtonProps = {
  recipe: {
    id_receta: string;
    nombre_receta: string;
    estado: string;
  };
  action: (prevState: StatusToggleState, formData: FormData) => Promise<StatusToggleState>;
  /** Avisos al activar e inactivar; la pagina los pasa con su clave literal. */
  activatedNotification: NotificationDefinition;
  deactivatedNotification: NotificationDefinition;
};

// Activar o inactivar una receta desde su fila (entrega 10.6b). Inactivar pide
// confirmar con el nombre y la consecuencia comprobada en el codigo: el formulario
// de ordenes solo ofrece versiones de recetas activas y crear una orden las exige;
// una version nueva, marcar vigente y cambiar sus materiales tambien; y el inicio de
// Produccion solo cuenta las activas. Las ordenes ya creadas no cambian. Activar se
// ejecuta al pulsar. Los dos envian el estado pedido y dan su aviso con el resultado.
export function RecipeStatusButton({
  recipe,
  action,
  activatedNotification,
  deactivatedNotification,
}: RecipeStatusButtonProps) {
  if (recipe.estado !== "activa") {
    return (
      <ConfirmActionButton
        action={action}
        fields={{ id_receta: recipe.id_receta, estado: "true" }}
        variant="ghost"
        successNotification={activatedNotification}
        pendingText="Activando..."
      >
        Activar
      </ConfirmActionButton>
    );
  }

  return (
    <ConfirmActionButton
      action={action}
      fields={{ id_receta: recipe.id_receta, estado: "false" }}
      variant="destructive"
      successNotification={deactivatedNotification}
      confirm={{
        title: `¿Inactivar la receta ${recipe.nombre_receta}?`,
        description:
          "Dejará de ofrecerse en las órdenes de trabajo nuevas, no admitirá versiones nuevas ni cambios en sus materiales, y saldrá de los conteos de Producción. Sus versiones y las órdenes ya creadas se conservan. Puedes volver a activarla.",
        confirmText: "Inactivar",
      }}
      pendingText="Inactivando..."
    >
      Inactivar
    </ConfirmActionButton>
  );
}
