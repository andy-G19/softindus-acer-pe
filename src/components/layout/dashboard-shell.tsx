import Image from "next/image";
import type { Session } from "next-auth";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import {
  DesktopSidebarNav,
  MobileDashboardNav,
} from "@/components/layout/dashboard-nav";
import { TopProgressBar } from "@/components/layout/top-progress-bar";
import { NotificationQueryBridge } from "@/components/notifications/notification-query-bridge";
import { SessionIdleGuard } from "@/modules/auth/components/session-idle-guard";
import { LogoutButton } from "@/modules/auth/components/logout-button";
import { getMenuForRole, getRoleLabel } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  session: Session;
  children: React.ReactNode;
};

export function DashboardShell({ session, children }: DashboardShellProps) {
  const menuItems = getMenuForRole(session.user.role);

  return (
    <div className="industrial-dark dark min-h-screen bg-[#0f1011] text-foreground">
      <SessionIdleGuard />
      <Suspense fallback={null}>
        <NotificationQueryBridge />
      </Suspense>

      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/95 backdrop-blur">
        <Suspense fallback={<div className="heat-bar" aria-hidden="true" />}>
          <TopProgressBar />
        </Suspense>
        <div className="flex w-full flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/images/logo-160.png"
              alt="Logo de Industrias Aceros Perú"
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
              priority
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-xl font-bold text-foreground">
                  Industrias Aceros Perú
                </h1>
                <Badge variant="success" className="text-[10.5px]">
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
                <Badge className="text-[10.5px]">
                  {getRoleLabel(session.user.role)}
                </Badge>
              </div>
            </div>

            <LogoutButton />
          </div>
        </div>
      </header>

      <aside
        className={cn(
          "group/sidebar hidden md:block",
          "md:fixed md:inset-y-0 md:left-0 md:z-30",
          "md:w-[76px] md:overflow-hidden md:border-r md:border-sidebar-border/80 md:bg-sidebar",
          "md:transition-[width] md:duration-200 md:ease-out",
          "md:hover:w-64 md:hover:overflow-visible md:hover:shadow-[8px_0_32px_rgba(0,0,0,0.45)]",
          "md:focus-within:w-64 md:focus-within:overflow-visible",
        )}
      >
        <div className="h-full overflow-y-auto pt-24">
          <div className="px-3 pb-3">
            <p
              className={cn(
                "text-xs font-semibold uppercase text-muted-foreground",
                "hidden md:group-hover/sidebar:block md:group-focus-within/sidebar:block",
              )}
            >
              Navegación
            </p>
          </div>
          <DesktopSidebarNav menuItems={menuItems} />
        </div>
      </aside>

      <div className="py-6 pl-4 pr-4 sm:pr-6 lg:pr-8 md:pl-[108px]">
        <div className="mb-6 md:hidden">
          <p className="mb-2 px-1 text-xs font-semibold uppercase text-muted-foreground">
            Navegación
          </p>
          <div className="rounded-xl border border-sidebar-border/80 bg-sidebar p-2">
            <MobileDashboardNav menuItems={menuItems} />
          </div>
        </div>

        <main className="min-w-0 w-full pb-8">{children}</main>
      </div>
    </div>
  );
}
