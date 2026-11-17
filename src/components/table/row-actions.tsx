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

type RowActionsProps = {
  children: ReactNode;
};

export function RowActions({ children }: RowActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  );
}
