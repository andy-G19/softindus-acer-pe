import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { StatusToggleState } from "@/lib/requested-status";

type ExpenseCategoryStatusButtonProps = {
  category: {
    id_categoria_gasto: string;
    nombre_categoria: string;
    estado: boolean;
  };
  action: (prevState: StatusToggleState, formData: FormData) => Promise<StatusToggleState>;
  /** Avisos al activar e inactivar; la pagina los pasa con su clave literal. */
  activatedNotification: NotificationDefinition;
  deactivatedNotification: NotificationDefinition;
};

// Activar o inactivar una categoria de gasto desde su fila (entrega 10).
// Inactivar pide confirmar con el nombre y la consecuencia; activar se ejecuta
// al pulsar. Los dos envian el estado pedido y dan su aviso con el resultado.
export function ExpenseCategoryStatusButton({
  category,
  action,
  activatedNotification,
  deactivatedNotification,
}: ExpenseCategoryStatusButtonProps) {
  if (!category.estado) {
    return (
      <ConfirmActionButton
        action={action}
        fields={{ id_categoria_gasto: category.id_categoria_gasto, estado: "true" }}
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
      fields={{ id_categoria_gasto: category.id_categoria_gasto, estado: "false" }}
      variant="destructive"
      successNotification={deactivatedNotification}
      confirm={{
        title: `¿Inactivar la categoría de gasto ${category.nombre_categoria}?`,
        description:
          "Dejará de ofrecerse al registrar gastos de caja chica; los gastos ya registrados la conservan. Puedes volver a activarla.",
        confirmText: "Inactivar",
      }}
      pendingText="Inactivando..."
    >
      Inactivar
    </ConfirmActionButton>
  );
}
