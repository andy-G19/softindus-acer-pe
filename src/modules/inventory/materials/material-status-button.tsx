import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { StatusToggleState } from "@/lib/requested-status";

type MaterialStatusButtonProps = {
  material: {
    id_material: string;
    nombre_material: string;
    estado: boolean;
  };
  action: (prevState: StatusToggleState, formData: FormData) => Promise<StatusToggleState>;
  /** Avisos al activar e inactivar; la pagina los pasa con su clave literal. */
  activatedNotification: NotificationDefinition;
  deactivatedNotification: NotificationDefinition;
};

// Activar o inactivar un material desde su fila (entrega 10.3). Inactivar pide
// confirmar con el nombre y la consecuencia comprobada en las consultas: las
// compras, salidas, recetas, chatarra, retazos y asociaciones con proveedores
// solo ofrecen y aceptan materiales activos, las entregas a ordenes de trabajo
// lo rechazan y Stock critico actual solo lista activos. Activar se ejecuta al
// pulsar. Los dos envian el estado pedido y dan su aviso con el resultado.
export function MaterialStatusButton({
  material,
  action,
  activatedNotification,
  deactivatedNotification,
}: MaterialStatusButtonProps) {
  if (!material.estado) {
    return (
      <ConfirmActionButton
        action={action}
        fields={{ id_material: material.id_material, estado: "true" }}
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
      fields={{ id_material: material.id_material, estado: "false" }}
      variant="destructive"
      successNotification={deactivatedNotification}
      confirm={{
        title: `¿Inactivar el material ${material.nombre_material}?`,
        description:
          "Dejará de ofrecerse en compras, salidas, recetas, chatarra, retazos y asociaciones con proveedores, las órdenes de trabajo que lo requieren no podrán recibirlo y saldrá de Stock crítico actual. Su stock, su kárdex y sus alertas se conservan. Puedes volver a activarlo.",
        confirmText: "Inactivar",
      }}
      pendingText="Inactivando..."
    >
      Inactivar
    </ConfirmActionButton>
  );
}
