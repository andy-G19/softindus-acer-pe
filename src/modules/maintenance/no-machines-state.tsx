import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type NoMachinesStateProps = {
  description: string;
  /** Registrar una maquina es solo de ADMIN: un enlace sigue a los roles de su destino. */
  canRegisterMachine: boolean;
};

export function NoMachinesState({ description, canRegisterMachine }: NoMachinesStateProps) {
  return (
    <EmptyState
      label="No hay maquinas registradas."
      description={description}
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
