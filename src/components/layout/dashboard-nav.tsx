"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Calculator,
  Circle,
  Factory,
  LayoutDashboard,
  Package,
  Recycle,
  ShoppingCart,
  UserRoundCheck,
  Users,
  WalletCards,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type DashboardNavItem = {
  title: string;
  href: string;
};

type DashboardNavProps = {
  menuItems: DashboardNavItem[];
};

const navIconsByHref: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/users": Users,
  "/dashboard/commercial": ShoppingCart,
  "/dashboard/inventory": Package,
  "/dashboard/production": Factory,
  "/dashboard/waste-scrap": Recycle,
  "/dashboard/costs": Calculator,
  "/dashboard/petty-cash": WalletCards,
  "/dashboard/staff": UserRoundCheck,
  "/dashboard/maintenance": Wrench,
  "/dashboard/reports": BarChart3,
};

const navLabelsByHref: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/users": "Usuarios",
  "/dashboard/commercial": "Comercial",
  "/dashboard/inventory": "Inventario",
  "/dashboard/production": "Producción",
  "/dashboard/waste-scrap": "Mermas y chatarra",
  "/dashboard/costs": "Costos",
  "/dashboard/petty-cash": "Caja chica",
  "/dashboard/staff": "Personal",
  "/dashboard/maintenance": "Mantenimiento",
  "/dashboard/reports": "Reportes",
};

function isRouteActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavLinksProps = {
  menuItems: DashboardNavItem[];
  pathname: string;
  collapsible?: boolean;
};

function NavLinks({ menuItems, pathname, collapsible = false }: NavLinksProps) {
  return (
    <>
      {menuItems.map((item) => {
        const isActive = isRouteActive(pathname, item.href);
        const Icon = navIconsByHref[item.href] ?? Circle;
        const label = navLabelsByHref[item.href] ?? item.title;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "sidebar-nav-link flex items-center gap-2 rounded-l-none rounded-r-lg border-l-[3px] border-l-transparent px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/35",
              collapsible
                ? "justify-center md:group-hover/sidebar:justify-start md:group-focus-within/sidebar:justify-start"
                : "min-w-max",
              isActive && "sidebar-nav-link-active",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span
              className={cn(
                "truncate",
                collapsible &&
                  "hidden md:group-hover/sidebar:inline md:group-focus-within/sidebar:inline",
              )}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </>
  );
}

export function MobileDashboardNav({ menuItems }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <div className="relative">
      <nav aria-label="Navegación principal" className="flex gap-2 overflow-x-auto pb-1">
        <NavLinks menuItems={menuItems} pathname={pathname} />
      </nav>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-sidebar to-transparent"
      />
    </div>
  );
}

export function DesktopSidebarNav({ menuItems }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-1 px-2">
      <NavLinks menuItems={menuItems} pathname={pathname} collapsible />
    </nav>
  );
}
