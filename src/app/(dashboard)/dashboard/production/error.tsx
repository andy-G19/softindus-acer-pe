"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

type ProductionErrorPageProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

export default function ProductionErrorPage({
  error,
  reset,
}: ProductionErrorPageProps) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <ErrorState
        title="Ocurrió un problema en Producción"
        description="El sistema no pudo completar la operación solicitada. Esto puede ocurrir por una validación, un dato relacionado que falta o una restricción del módulo."
        detail={error.message}
        actions={
          <>
            <Button type="button" onClick={reset}>
              Intentar nuevamente
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/production">Volver a producción</Link>
            </Button>
          </>
        }
      />
    </main>
  );
}
