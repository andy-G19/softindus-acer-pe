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
import type { ProductCategoryFormState } from "@/modules/commercial/products/actions";
import { ProductCategoryDialog } from "@/modules/commercial/products/product-category-dialog";

type ProductCategory = {
  id_categoria_producto: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  estado: boolean;
};

type ProductCategoryManagerProps = {
  categories: ProductCategory[];
  canManage: boolean;
  updateAction: (prevState: ProductCategoryFormState, formData: FormData) => Promise<ProductCategoryFormState>;
  /** Aviso al guardar una edicion; la pagina lo pasa con su clave literal. */
  updateNotification: NotificationDefinition;
  toggleAction: (formData: FormData) => Promise<void>;
};

// Lista de categorias de producto (entrega 9). La tabla es de solo lectura: el
// alta (en el encabezado de la pagina) y la edicion se hacen en una ventana
// modal, y quien no es ADMIN solo consulta. Activar e inactivar siguen siendo
// formularios con su redireccion ?toast=.
export function ProductCategoryManager({
  categories,
  canManage,
  updateAction,
  updateNotification,
  toggleAction,
}: ProductCategoryManagerProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Código</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category) => (
          <TableRow key={category.id_categoria_producto}>
            <TableCell className="text-xs">{category.id_categoria_producto}</TableCell>
            <TableCell>
              <span className="block font-medium">{category.nombre}</span>
              <span className="block text-xs text-muted-foreground">{category.slug}</span>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{category.descripcion ?? "-"}</TableCell>
            <TableCell>
              <Badge variant={category.estado ? "success" : "outline"}>
                {category.estado ? "Activa" : "Inactiva"}
              </Badge>
            </TableCell>
            <TableCell>
              {canManage ? (
                <div className="flex flex-wrap items-center gap-2">
                  <ProductCategoryDialog
                    action={updateAction}
                    category={category}
                    title="Editar categoría"
                    submitLabel="Guardar cambios"
                    successNotification={updateNotification}
                    trigger={
                      <Button type="button" variant="ghost" size="sm">
                        Editar
                      </Button>
                    }
                  />
                  <form action={toggleAction}>
                    <input type="hidden" name="id_categoria_producto" value={category.id_categoria_producto} />
                    <Button type="submit" variant="outline" size="sm">
                      {category.estado ? "Inactivar" : "Activar"}
                    </Button>
                  </form>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Solo lectura</span>
              )}
            </TableCell>
          </TableRow>
        ))}

        {categories.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="p-0">
              <EmptyState className="border-0" label="Todavía no hay categorías de productos registradas." />
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
