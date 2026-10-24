import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { StatusToggleState } from "@/lib/requested-status";

type ProductStatusButtonProps = {
  product: {
    id_producto: string;
    nombre_producto: string;
    estado: boolean;
  };
  action: (prevState: StatusToggleState, formData: FormData) => Promise<StatusToggleState>;
  /** Avisos al activar e inactivar; la pagina los pasa con su clave literal. */
  activatedNotification: NotificationDefinition;
  deactivatedNotification: NotificationDefinition;
};

// Activar o inactivar un producto desde su fila (entrega 10.4a). Inactivar pide
// confirmar con el nombre y la consecuencia comprobada en las consultas: los
// formularios de pedidos, rutas de fabricacion, recetas tecnicas nuevas,
// campanas y ordenes de trabajo solo ofrecen productos activos, los filtros de
// producto de Produccion y de su reporte solo los listan a ellos y el inicio de
// Comercial los cuenta en Productos activos; lo ya registrado los conserva.
// Activar se ejecuta al pulsar. Los dos envian el estado pedido y dan su aviso
// con el resultado.
export function ProductStatusButton({
  product,
  action,
  activatedNotification,
  deactivatedNotification,
}: ProductStatusButtonProps) {
  if (!product.estado) {
    return (
      <ConfirmActionButton
        action={action}
        fields={{ id_producto: product.id_producto, estado: "true" }}
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
      fields={{ id_producto: product.id_producto, estado: "false" }}
      variant="destructive"
      successNotification={deactivatedNotification}
      confirm={{
        title: `¿Inactivar el producto ${product.nombre_producto}?`,
        description:
          "Dejará de ofrecerse en pedidos, rutas de fabricación, recetas técnicas nuevas, campañas y órdenes de trabajo, y en los filtros de producto de Producción y de su reporte; no contará en Productos activos. Sus pedidos, rutas, recetas y órdenes se conservan. Puedes volver a activarlo.",
        confirmText: "Inactivar",
      }}
      pendingText="Inactivando..."
    >
      Inactivar
    </ConfirmActionButton>
  );
}
