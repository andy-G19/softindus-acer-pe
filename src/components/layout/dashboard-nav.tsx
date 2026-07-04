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

export function DashboardNav({ menuItems }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0"
    >
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
              "flex min-w-max items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground md:min-w-0",
              isActive &&
                "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
