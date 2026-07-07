import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export default function ProductionNotFoundPage() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <ErrorState
        icon={SearchX}
        title="Registro de producción no encontrado"
        description="El registro solicitado no existe, fue eliminado o el código usado no corresponde a un recurso válido del módulo de producción."
        actions={
          <>
            <Button asChild>
              <Link href="/dashboard/production">Ir al módulo Producción</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/production/work-orders">
                Ver órdenes de trabajo
              </Link>
            </Button>
          </>
        }
      />
    </main>
  );
}
