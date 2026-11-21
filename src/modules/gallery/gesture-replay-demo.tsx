"use client";

import { useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

// Las etiquetas hacen su gesto una sola vez, al montar (D153). En la galeria este boton vuelve a
// montar la fila para verlo de nuevo: una clave nueva reemplaza los nodos y el navegador arranca
// las animaciones desde el principio. No envia nada ni llama al servidor.
export function GestureReplayDemo({ children }: { children: ReactNode }) {
  const [round, setRound] = useState(0);

  return (
    <div className="flex w-full flex-col items-start gap-3">
      <div key={round} className="flex flex-wrap items-center gap-2.5">
        {children}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => setRound((value) => value + 1)}>
        <RotateCcw data-icon="inline-start" />
        Repetir gestos
      </Button>
    </div>
  );
}
