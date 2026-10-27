import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { StatusToggleState } from "@/lib/requested-status";

type ProductCategoryStatusButtonProps = {
  category: {
    id_categoria_producto: string;
    nombre: string;
    estado: boolean;
  };
  action: (prevState: StatusToggleState, formData: FormData) => Promise<StatusToggleState>;
  /** Avisos al activar e inactivar; la pagina los pasa con su clave literal. */
  activatedNotification: NotificationDefinition;
  deactivatedNotification: NotificationDefinition;
};

// Activar o inactivar una categoria de producto desde su fila (entrega 10.4a).
// Inactivar pide confirmar con el nombre y la consecuencia comprobada en las
// consultas: el alta de productos solo ofrece categorias activas y la edicion
// solo agrega la actual del producto, que se puede seguir guardando (C3 de la
// 10.4a). Activar se ejecuta al pulsar. Los dos envian el estado pedido y dan
// su aviso con el resultado.
export function ProductCategoryStatusButton({
  category,
  action,
  activatedNotification,
  deactivatedNotification,
}: ProductCategoryStatusButtonProps) {
  if (!category.estado) {
    return (
      <ConfirmActionButton
        action={action}
        fields={{ id_categoria_producto: category.id_categoria_producto, estado: "true" }}
        variant="outline"
        size="sm"
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
      fields={{ id_categoria_producto: category.id_categoria_producto, estado: "false" }}
      variant="outline"
      size="sm"
      successNotification={deactivatedNotification}
      confirm={{
        title: `¿Inactivar la categoría ${category.nombre}?`,
        description:
          "Dejará de ofrecerse al registrar productos o cambiar la categoría de uno. Los productos que ya la usan la conservan y se pueden seguir editando. Puedes volver a activarla.",
        confirmText: "Inactivar",
      }}
      pendingText="Inactivando..."
    >
      Inactivar
    </ConfirmActionButton>
  );
}
