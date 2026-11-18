"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

type DashboardErrorPageProps = {
  error: Error & {
    digest?: string;
  };
  // Vuelve a pedir los datos al servidor (router.refresh) y luego limpia el error;
  // `reset` solo limpiaria el error y mostraria el mismo fallo otra vez.
  unstable_retry: () => void;
};

// Error de cualquier pagina del panel que no tenga uno propio (11.7b). Queda dentro
// del layout del segmento, el del shell: el menu y la cabecera siguen disponibles.
// Muestra el digest, que permite buscar el error en los registros, y nunca
// error.message: en produccion Next lo cambia por un texto generico en ingles, y en
// desarrollo podria mostrar detalles internos.
export default function DashboardErrorPage({
  error,
  unstable_retry,
}: DashboardErrorPageProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <ErrorState
        title="Ocurrió un problema"
        description="El sistema no pudo cargar esta pantalla. Puede intentarlo nuevamente o volver al inicio; si el problema continúa, comunique el código de referencia."
        detail={error.digest ? `Código de referencia: ${error.digest}` : undefined}
        actions={
          <>
            <Button type="button" onClick={() => unstable_retry()}>
              Intentar nuevamente
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">Volver al inicio</Link>
            </Button>
          </>
        }
      />
    </div>
  );
}
