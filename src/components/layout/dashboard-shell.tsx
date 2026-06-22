import Link from "next/link";
import type { Session } from "next-auth";

import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/modules/auth/components/logout-button";
import { getMenuForRole, getRoleLabel } from "@/lib/permissions";

type DashboardShellProps = {
  session: Session;
  children: React.ReactNode;
};

export function DashboardShell({ session, children }: DashboardShellProps) {
  const menuItems = getMenuForRole(session.user.role);

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">Industrias Aceros Perú</h1>
            <p className="text-sm text-muted-foreground">
              Sistema de Gestión Integral
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{session.user.name}</p>
              <div className="mt-1 flex justify-end">
                <Badge variant="secondary">
                  {getRoleLabel(session.user.role)}
                </Badge>
              </div>
            </div>

            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-lg border bg-background p-4">
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}