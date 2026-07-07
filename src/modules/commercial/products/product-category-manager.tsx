"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import {
  createProductCategoryAction,
  updateProductCategoryAction,
  type ProductCategoryFormState,
} from "@/modules/commercial/products/actions";

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
  toggleAction: (formData: FormData) => Promise<void>;
};

const initialState: ProductCategoryFormState = {
  error: "",
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

function CategoryCreateForm({ canManage }: { canManage: boolean }) {
  const [state, formAction, isPending] = useActionState(
    createProductCategoryAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-lg border border-border/80 bg-card p-6"
    >
      <h2 className="text-base font-semibold text-foreground">
        Nueva categoría
      </h2>

      {state.error ? (
        <p role="alert" aria-live="polite" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre</Label>
        <Input
          id="nombre"
          name="nombre"
          placeholder="Ejemplo: Herramientas agrícolas"
          disabled={!canManage}
          required
        />
        <FieldError messages={state.fieldErrors?.nombre} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          className="min-h-24"
          placeholder="Uso interno de la categoría."
          disabled={!canManage}
        />
        <FieldError messages={state.fieldErrors?.descripcion} />
      </div>

      <Button type="submit" disabled={!canManage || isPending}>
        {isPending ? "Guardando..." : "Crear categoría"}
      </Button>
    </form>
  );
}

function CategoryRow({
  category,
  canManage,
  toggleAction,
}: {
  category: ProductCategory;
  canManage: boolean;
  toggleAction: (formData: FormData) => Promise<void>;
}) {
  const [state, formAction, isPending] = useActionState(
    updateProductCategoryAction,
    initialState,
  );

  return (
    <TableRow className="align-top">
      <TableCell className="text-xs">
        {category.id_categoria_producto}
      </TableCell>
      <TableCell colSpan={2}>
        <form action={formAction} className="space-y-2">
          <input
            type="hidden"
            name="id_categoria_producto"
            value={category.id_categoria_producto}
          />
          <Input
            name="nombre"
            defaultValue={category.nombre}
            disabled={!canManage}
            required
          />
          <p className="text-xs text-muted-foreground">{category.slug}</p>
          <FieldError messages={state.fieldErrors?.nombre} />
          <Textarea
            name="descripcion"
            defaultValue={category.descripcion ?? ""}
            className="min-h-20"
            disabled={!canManage}
          />
          <FieldError messages={state.fieldErrors?.descripcion} />
          {state.error ? (
            <p role="alert" className="text-xs text-destructive">
              {state.error}
            </p>
          ) : null}
          {canManage ? (
            <Button type="submit" variant="outline" size="sm" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          ) : null}
        </form>
      </TableCell>
      <TableCell>
        <Badge variant={category.estado ? "success" : "outline"}>
          {category.estado ? "Activa" : "Inactiva"}
        </Badge>
      </TableCell>
      <TableCell>
        {canManage ? (
          <form action={toggleAction}>
            <input
              type="hidden"
              name="id_categoria_producto"
              value={category.id_categoria_producto}
            />
            <Button type="submit" variant="outline" size="sm">
              {category.estado ? "Inactivar" : "Activar"}
            </Button>
          </form>
        ) : (
          <span className="text-xs text-muted-foreground">Solo lectura</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export function ProductCategoryManager({
  categories,
  canManage,
  toggleAction,
}: ProductCategoryManagerProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <CategoryCreateForm canManage={canManage} />

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
            <CategoryRow
              key={category.id_categoria_producto}
              category={category}
              canManage={canManage}
              toggleAction={toggleAction}
            />
          ))}

          {categories.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay categorías de productos registradas."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
