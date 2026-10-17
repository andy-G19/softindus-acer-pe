import type { ReactNode } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type RowEditLinkProps = {
  href: string;
  label?: string;
};

export function RowEditLink({ href, label = "Editar" }: RowEditLinkProps) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href={href}>{label}</Link>
    </Button>
  );
}

type RowToggleStatusButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFieldName: string;
  hiddenFieldValue: string | number;
  isActive: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  /**
   * Envia tambien el estado pedido (estado=false al inactivar, true al
   * activar) para las acciones que lo fijan comparando y escribiendo en una
   * sola sentencia (entrega 10, src/lib/requested-status.ts).
   */
  sendsRequestedStatus?: boolean;
};

export function RowToggleStatusButton({
  action,
  hiddenFieldName,
  hiddenFieldValue,
  isActive,
  activeLabel = "Inactivar",
  inactiveLabel = "Activar",
  sendsRequestedStatus = false,
}: RowToggleStatusButtonProps) {
  return (
    <form action={action}>
      <input type="hidden" name={hiddenFieldName} value={hiddenFieldValue} />
      {sendsRequestedStatus ? (
        <input type="hidden" name="estado" value={isActive ? "false" : "true"} />
      ) : null}
      <Button
        type="submit"
        variant={isActive ? "destructive" : "ghost"}
        size="sm"
      >
        {isActive ? activeLabel : inactiveLabel}
      </Button>
    </form>
  );
}

type RowActionsProps = {
  children: ReactNode;
};

export function RowActions({ children }: RowActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  );
}
