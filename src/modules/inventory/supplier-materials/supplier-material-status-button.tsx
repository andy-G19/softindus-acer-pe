import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { StatusToggleState } from "@/lib/requested-status";

type SupplierMaterialStatusButtonProps = {
  relation: {
    id_proveedor_material: string;
    estado: boolean;
    proveedor: { razon_social: string };
    material: { nombre_material: string };
  };
  action: (prevState: StatusToggleState, formData: FormData) => Promise<StatusToggleState>;
  /** Avisos al activar e inactivar; la pagina los pasa con su clave literal. */
  activatedNotification: NotificationDefinition;
  deactivatedNotification: NotificationDefinition;
};

// Activar o inactivar una asociacion proveedor-material desde su fila
// (entrega 10.3b). Inactivar pide confirmar con el proveedor, el material y la
// consecuencia comprobada en las consultas: ninguna otra pantalla lee las
// asociaciones, asi que no cambia compras ni stock. Activar se ejecuta al
// pulsar. Los dos envian el estado pedido y dan su aviso con el resultado.
export function SupplierMaterialStatusButton({
  relation,
  action,
  activatedNotification,
  deactivatedNotification,
}: SupplierMaterialStatusButtonProps) {
  if (!relation.estado) {
    return (
      <ConfirmActionButton
        action={action}
        fields={{ id_proveedor_material: relation.id_proveedor_material, estado: "true" }}
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
      fields={{ id_proveedor_material: relation.id_proveedor_material, estado: "false" }}
      variant="destructive"
      successNotification={deactivatedNotification}
      confirm={{
        title: `¿Inactivar la asociación ${relation.proveedor.razon_social} – ${relation.material.nombre_material}?`,
        description:
          "Quedará inactiva en este listado. Ninguna otra pantalla usa las asociaciones: no cambia compras ni stock. Puedes volver a activarla.",
        confirmText: "Inactivar",
      }}
      pendingText="Inactivando..."
    >
      Inactivar
    </ConfirmActionButton>
  );
}
