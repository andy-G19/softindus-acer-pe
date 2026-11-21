import type { ReactNode } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

// Acciones de una fila. Desde el diseno de listados (2026-11-21; D166) Editar es un enlace de texto
// (la variante row-link de Button) y las acciones van alineadas a la derecha, con 8 px entre ellas;
// la accion destructiva de la fila es un boton xs.

type RowEditLinkProps = {
  href: string;
  label?: string;
};

export function RowEditLink({ href, label = "Editar" }: RowEditLinkProps) {
  return (
    <Button variant="row-link" asChild>
      <Link href={href}>{label}</Link>
    </Button>
  );
}

type RowActionsProps = {
  children: ReactNode;
};

export function RowActions({ children }: RowActionsProps) {
  return (
    <div data-slot="row-actions" className="flex flex-wrap items-center justify-end gap-2">
      {children}
    </div>
  );
}
