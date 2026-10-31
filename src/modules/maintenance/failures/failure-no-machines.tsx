import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type FailureNoMachinesProps = {
  /** Registrar una maquina es solo de ADMIN: un enlace sigue a los roles de su destino. */
  canRegisterMachine: boolean;
};

export function FailureNoMachines({ canRegisterMachine }: FailureNoMachinesProps) {
  return (
    <EmptyState
      label="No hay maquinas registradas."
      description="Primero registra una maquina para poder documentar sus fallas."
      action={
        canRegisterMachine ? (
          <Button asChild>
            <Link href="/dashboard/maintenance/machines/new">Registrar maquina</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
