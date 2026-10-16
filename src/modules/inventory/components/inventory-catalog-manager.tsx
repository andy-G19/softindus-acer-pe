import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { InventoryCatalogFormState } from "@/modules/inventory/catalog-form-state";
import {
  InventoryCatalogDialog,
  type InventoryCatalogItem,
} from "@/modules/inventory/components/inventory-catalog-dialog";

type CatalogItem = InventoryCatalogItem & {
  estado: boolean;
};

type InventoryCatalogManagerProps = {
  idFieldName: string;
  items: CatalogItem[];
  updateAction: (prevState: InventoryCatalogFormState, formData: FormData) => Promise<InventoryCatalogFormState>;
  /** Aviso al guardar una edicion; la pagina lo pasa con su clave literal. */
  updateNotification: NotificationDefinition;
  toggleAction: (formData: FormData) => Promise<void>;
  canManage: boolean;
  /** Titulo de la ventana de edicion ("Editar tipo de proveedor"). */
  editTitle: string;
  /** Pregunta de la confirmacion de descarte ("¿Descartar el tipo de proveedor?"). */
  discardTitle: string;
  emptyMessage: string;
};

// Lista de un catalogo de inventario: tipos de proveedor o categorias de
// material (entrega 10). La tabla es de solo lectura: el alta (en el
// encabezado de la pagina) y la edicion se hacen en una ventana modal, y quien
// no es ADMIN solo consulta. Activar e inactivar siguen siendo formularios con
// su redireccion ?toast= y envian el estado pedido.
export function InventoryCatalogManager({
  idFieldName,
  items,
  updateAction,
  updateNotification,
  toggleAction,
  canManage,
  editTitle,
  discardTitle,
  emptyMessage,
}: InventoryCatalogManagerProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Código</TableHead>
          <TableHead>Nombre</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="text-xs">{item.id}</TableCell>
            <TableCell className="font-medium">{item.nombre}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{item.slug}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{item.descripcion ?? "-"}</TableCell>
            <TableCell>
              <Badge variant={item.estado ? "success" : "outline"}>
                {item.estado ? "Activa" : "Inactiva"}
              </Badge>
            </TableCell>
            <TableCell>
              {canManage ? (
                <div className="flex flex-wrap items-center gap-2">
                  <InventoryCatalogDialog
                    action={updateAction}
                    idFieldName={idFieldName}
                    item={item}
                    title={editTitle}
                    submitLabel="Guardar cambios"
                    successNotification={updateNotification}
                    discardTitle={discardTitle}
                    trigger={
                      <Button type="button" variant="ghost" size="sm">
                        Editar
                      </Button>
                    }
                  />
                  <form action={toggleAction}>
                    <input type="hidden" name={idFieldName} value={item.id} />
                    <input type="hidden" name="estado" value={item.estado ? "false" : "true"} />
                    <Button type="submit" variant="outline" size="sm">
                      {item.estado ? "Inactivar" : "Activar"}
                    </Button>
                  </form>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Solo lectura</span>
              )}
            </TableCell>
          </TableRow>
        ))}

        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="p-0">
              <EmptyState className="border-0" label={emptyMessage} />
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
