import { UserRole, UserStatus } from "@/generated/prisma/client";

export const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrador",
  SELLER: "Vendedor",
  WORKSHOP_MASTER: "Maestro de taller",
};

export const userStatusLabels: Record<UserStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
};

type DashboardRoute = {
  title: string;
  href: string;
  roles: UserRole[];
};

export const dashboardRoutes: DashboardRoute[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    roles: [UserRole.ADMIN, UserRole.SELLER, UserRole.WORKSHOP_MASTER],
  },
  {
    title: "Usuarios",
    href: "/dashboard/users",
    roles: [UserRole.ADMIN],
  },
  {
    title: "Acceso denegado",
    href: "/dashboard/access-denied",
    roles: [UserRole.ADMIN, UserRole.SELLER, UserRole.WORKSHOP_MASTER],
  },
];

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export function getMenuForRole(role: UserRole) {
  return dashboardRoutes.filter((route) => {
    if (route.href === "/dashboard/access-denied") {
      return false;
    }

    return route.roles.includes(role);
  });
}

export function canAccessDashboardRoute(role: UserRole, pathname: string) {
  const normalizedPathname = normalizePath(pathname);

  const matchedRoute = dashboardRoutes
    .filter((route) => {
      return (
        normalizedPathname === route.href ||
        normalizedPathname.startsWith(`${route.href}/`)
      );
    })
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (!matchedRoute) {
    return false;
  }

  return matchedRoute.roles.includes(role);
}