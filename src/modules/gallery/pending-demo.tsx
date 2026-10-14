"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

const PENDING_MS = 2000;

// Simula el estado pendiente solo en el navegador: ningun boton envia un
// formulario ni llama al servidor. En las pantallas lo da SubmitButton con
// useFormStatus mientras corre la accion del formulario.
export function PendingDemo() {
  const [pending, setPending] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function simulate() {
    setPending(true);
    timer.current = window.setTimeout(() => setPending(false), PENDING_MS);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" pending={pending} pendingText="Guardando..." onClick={simulate}>
        Guardar (simula 2 s)
      </Button>
      <Button type="button" variant="outline" pending={pending} onClick={simulate}>
        Exportar (simula 2 s)
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="icon"
        aria-label="Eliminar (simula 2 s)"
        pending={pending}
        onClick={simulate}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
