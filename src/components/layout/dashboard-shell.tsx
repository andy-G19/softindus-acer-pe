import Image from "next/image";
import type { Session } from "next-auth";

import { Badge } from "@/components/ui/badge";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { SessionIdleGuard } from "@/modules/auth/components/session-idle-guard";
import { LogoutButton } from "@/modules/auth/components/logout-button";
import { getMenuForRole, getRoleLabel } from "@/lib/permissions";

type DashboardShellProps = {
  session: Session;
  children: React.ReactNode;
};

export function DashboardShell({ session, children }: DashboardShellProps) {
  const menuItems = getMenuForRole(session.user.role);

  return (
    <div className="industrial-dark dark min-h-screen bg-[#0f1011] text-foreground">
      <SessionIdleGuard />

      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/95 backdrop-blur">
        <div className="heat-bar" aria-hidden="true" />
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/images/logo-aceros-peru.png"
              alt="Logo de Industrias Aceros Perú"
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 object-contain"
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-xl font-bold text-foreground">
                  Industrias Aceros Perú
                </h1>
                <Badge
                  variant="success"
                  className="text-[10.5px]"
                >
                  Sistema activo
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Sistema de Gestión Integral
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <div className="min-w-0 text-left sm:text-right">
              <p className="truncate text-sm font-medium text-foreground">
                {session.user.name}
              </p>
              <div className="mt-1 flex sm:justify-end">
                <Badge
                  className="text-[10.5px]"
                >
                  {getRoleLabel(session.user.role)}
                </Badge>
              </div>
            </div>

            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="min-w-0">
          <div className="rounded-xl border border-sidebar-border/80 bg-sidebar p-3 shadow-[0_18px_45px_rgba(0,0,0,0.22)] md:sticky md:top-24">
            <div className="px-2 pb-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Navegación
              </p>
            </div>
            <DashboardNav menuItems={menuItems} />
          </div>
        </aside>

        <main className="min-w-0 pb-8">{children}</main>
      </div>
    </div>
  );
}
