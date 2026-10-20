import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { StatusToggleState } from "@/lib/requested-status";

type SupplierStatusButtonProps = {
  supplier: {
    id_proveedor: string;
    razon_social: string;
    estado: boolean;
  };
  action: (prevState: StatusToggleState, formData: FormData) => Promise<StatusToggleState>;
  /** Avisos al activar e inactivar; la pagina los pasa con su clave literal. */
  activatedNotification: NotificationDefinition;
  deactivatedNotification: NotificationDefinition;
};

// Activar o inactivar un proveedor desde su fila (entrega 10.3b). Inactivar
// pide confirmar con la razon social y la consecuencia comprobada en las
// consultas: las compras, los repuestos y las asociaciones nuevas solo ofrecen
// y aceptan proveedores activos, el filtro del reporte de proveedores y
// compras solo los lista a ellos y el inicio de Inventario los cuenta en
// Proveedores activos; sus compras, pagos y asociaciones se conservan. Activar
// se ejecuta al pulsar. Los dos envian el estado pedido y dan su aviso con el
// resultado.
export function SupplierStatusButton({
  supplier,
  action,
  activatedNotification,
  deactivatedNotification,
}: SupplierStatusButtonProps) {
  if (!supplier.estado) {
    return (
      <ConfirmActionButton
        action={action}
        fields={{ id_proveedor: supplier.id_proveedor, estado: "true" }}
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
      fields={{ id_proveedor: supplier.id_proveedor, estado: "false" }}
      variant="destructive"
      successNotification={deactivatedNotification}
      confirm={{
        title: `¿Inactivar el proveedor ${supplier.razon_social}?`,
        description:
          "Dejará de ofrecerse en compras, repuestos y asociaciones nuevas con materiales, y en el filtro del reporte de proveedores y compras; no contará en Proveedores activos. Sus compras, pagos y asociaciones se conservan. Puedes volver a activarlo.",
        confirmText: "Inactivar",
      }}
      pendingText="Inactivando..."
    >
      Inactivar
    </ConfirmActionButton>
  );
}
