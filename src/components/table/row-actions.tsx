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
};

export function RowToggleStatusButton({
  action,
  hiddenFieldName,
  hiddenFieldValue,
  isActive,
  activeLabel = "Inactivar",
  inactiveLabel = "Activar",
}: RowToggleStatusButtonProps) {
  return (
    <form action={action}>
      <input type="hidden" name={hiddenFieldName} value={hiddenFieldValue} />
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
