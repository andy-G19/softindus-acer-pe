"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { showInfo } from "@/lib/notifications";

const DEMO_NOTE = "Ejemplo de la galería: no se guardó nada.";
const PENDING_MS = 1500;

const LINEAS = Array.from({ length: 24 }, (_, index) => ({
  codigo: `PRD${String(index + 1).padStart(8, "0")}`,
  descripcion: `Plancha de acero estructural ${index + 1}`,
  cantidad: (index % 5) + 1,
}));

// Ventana con un formulario: el <form> envuelve cuerpo y pie para que el boton
// de envio quede dentro. Aqui el envio solo espera en el navegador; en una
// pantalla seria la accion del formulario con SubmitButton.
function FormDialogDemo() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    timer.current = window.setTimeout(() => {
      setPending(false);
      setOpen(false);
      showInfo("Pago de ejemplo registrado", DEMO_NOTE);
    }, PENDING_MS);
  }

  // Mientras se registra, Esc, el velo y la X no cierran.
  function changeOpen(next: boolean) {
    if (!pending) {
      setOpen(next);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button type="button">Ventana con formulario</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>Pedido PED00000099 · saldo S/ 1,250.00</DialogDescription>
        </DialogHeader>
        <form method="get" onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            <Field id="galeria-pago-monto" label="Monto" description="En soles." required>
              {(control) => <Input {...control} type="number" step="0.01" min="0" defaultValue="500.00" />}
            </Field>
            <Field id="galeria-pago-medio" label="Medio de pago" required>
              {(control) => (
                <NativeSelect {...control} defaultValue="transferencia">
                  <option value="transferencia">Transferencia</option>
                  <option value="efectivo">Efectivo</option>
                </NativeSelect>
              )}
            </Field>
            <Field id="galeria-pago-nota" label="Observaciones">
              {(control) => <Textarea {...control} placeholder="Número de operación u otro detalle" />}
            </Field>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" pending={pending} pendingText="Registrando...">
              Registrar pago
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Contenido largo: el encabezado y el pie quedan fijos y solo el cuerpo se
// desplaza.
function LongDialogDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Ventana con contenido largo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalle del pedido PED00000099</DialogTitle>
          <DialogDescription>{LINEAS.length} productos de ejemplo.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="divide-y divide-border/80 text-sm">
            {LINEAS.map((linea) => (
              <li key={linea.codigo} className="flex items-center justify-between gap-4 py-2">
                <span className="min-w-0">
                  <span className="block font-mono text-xs text-muted-foreground">{linea.codigo}</span>
                  <span className="block truncate">{linea.descripcion}</span>
                </span>
                <span className="shrink-0 tabular-nums">{linea.cantidad} und.</span>
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cerrar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FiltersSheetDemo() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="secondary">
          Panel derecho (filtros)
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Acota la lista de pedidos de ejemplo.</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <Field id="galeria-filtro-estado" label="Estado">
            {(control) => (
              <NativeSelect {...control} defaultValue="">
                <option value="">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
              </NativeSelect>
            )}
          </Field>
          <Field id="galeria-filtro-desde" label="Desde">
            {(control) => <Input {...control} type="date" defaultValue="2026-10-01" />}
          </Field>
        </SheetBody>
        <SheetFooter>
          <SheetClose asChild>
            <Button type="button" variant="outline">
              Limpiar
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button type="button">Aplicar</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Sin descripcion: aria-describedby={undefined} le dice a Radix que es a
// proposito.
function MenuSheetDemo() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="secondary">
          Panel izquierdo (sin descripción)
        </Button>
      </SheetTrigger>
      <SheetContent side="left" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Menú de ejemplo</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <nav aria-label="Menú de ejemplo" className="grid gap-1 text-sm">
            {["Clientes", "Pedidos", "Materiales", "Órdenes de trabajo"].map((item) => (
              <a key={item} href="#ventanas" className="rounded-md px-3 py-2 hover:bg-muted">
                {item}
              </a>
            ))}
          </nav>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

export function DialogDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FormDialogDemo />
      <LongDialogDemo />
      <FiltersSheetDemo />
      <MenuSheetDemo />
    </div>
  );
}
