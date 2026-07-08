"use client";

import { useActionState, useEffect, useRef } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import { showError, showSuccess } from "@/lib/notifications";

type CatalogFormState = {
  error: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

function useToastOnSubmit(
  state: CatalogFormState,
  isPending: boolean,
  successMessage: string,
) {
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending) {
      if (state.error) {
        showError(
          "No se pudo completar la operación",
          "Revise los datos ingresados e inténtelo nuevamente.",
        );
      } else {
        showSuccess(successMessage);
      }
    }

    wasPending.current = isPending;
  }, [isPending, state.error, successMessage]);
}

type CatalogItem = {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  estado: boolean;
};

type CatalogAction = (
  prevState: CatalogFormState,
  formData: FormData,
) => Promise<CatalogFormState>;

type InventoryCatalogManagerProps = {
  idFieldName: string;
  items: CatalogItem[];
  createAction: CatalogAction;
  updateAction: CatalogAction;
  toggleAction: (formData: FormData) => Promise<void>;
  canManage: boolean;
  createTitle: string;
  emptyMessage: string;
};

const initialState: CatalogFormState = {
  error: "",
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

function CreateCatalogForm({
  action,
  canManage,
  title,
}: {
  action: CatalogAction;
  canManage: boolean;
  title: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  useToastOnSubmit(state, isPending, "Registro creado correctamente");

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
    >
      <h2 className="text-base font-semibold text-foreground">{title}</h2>

      {state.error ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" name="nombre" disabled={!canManage} required />
        <FieldError messages={state.fieldErrors?.nombre} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          placeholder="materia_prima"
          disabled={!canManage}
          required
        />
        <FieldError messages={state.fieldErrors?.slug} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          rows={4}
          disabled={!canManage}
        />
        <FieldError messages={state.fieldErrors?.descripcion} />
      </div>

      <Button type="submit" disabled={!canManage || isPending}>
        {isPending ? "Guardando..." : "Crear"}
      </Button>
    </form>
  );
}

function CatalogRow({
  idFieldName,
  item,
  updateAction,
  toggleAction,
  canManage,
}: {
  idFieldName: string;
  item: CatalogItem;
  updateAction: CatalogAction;
  toggleAction: (formData: FormData) => Promise<void>;
  canManage: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    updateAction,
    initialState,
  );

  useToastOnSubmit(state, isPending, "Registro actualizado correctamente");

  return (
    <TableRow className="align-top">
      <TableCell className="text-xs">{item.id}</TableCell>
      <TableCell colSpan={3}>
        <form
          action={formAction}
          className="grid gap-2 md:grid-cols-[1fr_1fr_1.4fr_auto]"
        >
          <input type="hidden" name={idFieldName} value={item.id} />
          <div className="space-y-1">
            <Input
              name="nombre"
              defaultValue={item.nombre}
              disabled={!canManage}
              required
            />
            <FieldError messages={state.fieldErrors?.nombre} />
          </div>
          <div className="space-y-1">
            <Input
              name="slug"
              defaultValue={item.slug}
              disabled={!canManage}
              required
            />
            <FieldError messages={state.fieldErrors?.slug} />
          </div>
          <div className="space-y-1">
            <Textarea
              name="descripcion"
              defaultValue={item.descripcion ?? ""}
              className="min-h-10"
              disabled={!canManage}
            />
            <FieldError messages={state.fieldErrors?.descripcion} />
            {state.error ? (
              <p role="alert" className="text-xs text-destructive">
                {state.error}
              </p>
            ) : null}
          </div>
          {canManage ? (
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={isPending}
            >
              {isPending ? "Guardando..." : "Editar"}
            </Button>
          ) : null}
        </form>
      </TableCell>
      <TableCell>
        <Badge variant={item.estado ? "success" : "outline"}>
          {item.estado ? "Activa" : "Inactiva"}
        </Badge>
      </TableCell>
      <TableCell>
        {canManage ? (
          <form action={toggleAction}>
            <input type="hidden" name={idFieldName} value={item.id} />
            <Button type="submit" variant="outline" size="sm">
              {item.estado ? "Inactivar" : "Activar"}
            </Button>
          </form>
        ) : (
          <span className="text-xs text-muted-foreground">Solo lectura</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export function InventoryCatalogManager({
  idFieldName,
  items,
  createAction,
  updateAction,
  toggleAction,
  canManage,
  createTitle,
  emptyMessage,
}: InventoryCatalogManagerProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <CreateCatalogForm
        action={createAction}
        canManage={canManage}
        title={createTitle}
      />

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
            <CatalogRow
              key={item.id}
              idFieldName={idFieldName}
              item={item}
              updateAction={updateAction}
              toggleAction={toggleAction}
              canManage={canManage}
            />
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
    </div>
  );
}
